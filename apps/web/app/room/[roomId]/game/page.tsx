"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Command, FactionId, GameState, TurnEvent } from "@wargame/shared";
import { ActionPalette } from "@/components/game/ActionPalette";
import { CommandPanelBody } from "@/components/game/CommandPanel";
import { EventLog } from "@/components/game/EventLog";
import { GameLayout } from "@/components/game/GameLayout";
import { MapView } from "@/components/game/MapView";
import { OrderStrip } from "@/components/game/OrderStrip";
import { GameOver } from "@/components/game/GameOver";
import { TurnDebrief } from "@/components/game/TurnDebrief";
import { TurnHeader } from "@/components/game/TurnHeader";
import { UnitInspector } from "@/components/game/UnitInspector";
import {
  getAdjacentNodes,
  getAlliesOnNode,
  getAvailableActions,
  getEnemiesOnNode,
  getRetreatTargets,
  type ActionType,
} from "@/lib/actions";
import { nodeNameMap } from "@/lib/map-display";
import {
  buildCommandFromDraft,
  commandToDraft,
  createDraft,
  isDraftComplete,
  mapPickModeForDraft,
  type OrderDraft,
} from "@/lib/order-draft";
import { useRoom } from "@/hooks/useRoom";
import { useSocket } from "@/hooks/useSocket";
import { formatEvent } from "@/lib/format-event";

interface DebriefState {
  completedTurn: number;
  events: TurnEvent[];
  availableTurns: number[];
  initialState: GameState;
}

function GroupInspector({
  unitIds,
  gameState,
  nodeNames,
  onClear,
}: {
  unitIds: string[];
  gameState: GameState;
  nodeNames: Record<string, string>;
  onClear: () => void;
}) {
  const units = unitIds.map((id) => gameState.units[id]).filter(Boolean);
  const nodeName = units[0] ? nodeNames[units[0].nodeId] ?? units[0].nodeId : "";
  return (
    <div
      className="p-3 space-y-2"
      style={{ fontFamily: "var(--font-mono), monospace" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: "var(--color-gold)" }}
          >
            Group Command
          </p>
          <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "#ccc" }}>
            {units.length} units · {nodeName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded border px-2 py-0.5 text-[9px] transition-colors"
          style={{
            border: "1px solid #333",
            color: "#555",
            background: "transparent",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#555")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
        >
          Clear
        </button>
      </div>
      <div className="space-y-0.5">
        {units.map((u) =>
          u ? (
            <div
              key={u.id}
              className="flex items-center gap-1.5 rounded px-1.5 py-0.5"
              style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    u.factionId === "rohan" ? "#5ecb6b" : "#e05555",
                }}
              />
              <span
                className="flex-1 truncate font-bold uppercase"
                style={{ fontSize: "9px", color: "#aaa", letterSpacing: "0.06em" }}
              >
                {u.name}
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: "8px",
                  color:
                    u.strength >= 0.7
                      ? "#5ecb6b"
                      : u.strength >= 0.4
                        ? "#c8941a"
                        : "#e05555",
                }}
              >
                {Math.round(u.strength * 100)}%
              </span>
            </div>
          ) : null
        )}
      </div>
      <p className="text-[8px] italic" style={{ color: "#444" }}>
        Pick an order below — it will be issued to all units above.
      </p>
    </div>
  );
}

export default function GamePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId ?? "";
  const { snapshot, refresh, events, pushEvent, error: roomError, loading: roomLoading } = useRoom(roomId);
  const [localState, setLocalState] = useState<GameState | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [draftIsNew, setDraftIsNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const lastPersistedKey = useRef<string | null>(null);
  const [logOpen, setLogOpen] = useState(true);
  const [activeFaction, setActiveFaction] = useState<FactionId>("rohan");
  const [debrief, setDebrief] = useState<DebriefState | null>(null);
  const prevTurnRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  // Group command state — lets the player select all units on a node at once
  const [groupUnitIds, setGroupUnitIds] = useState<string[]>([]);
  const groupUnitIdsRef = useRef<string[]>([]);

  const gameState = localState ?? snapshot?.game?.state ?? null;
  const soloDualFaction = snapshot?.room?.soloDualFaction ?? false;
  const myFaction = snapshot?.viewer?.factionId;
  const commandingFaction = soloDualFaction ? activeFaction : myFaction;
  const orders = snapshot?.orders ?? [];

  useEffect(() => {
    if (myFaction && (myFaction === "rohan" || myFaction === "isengard")) {
      setActiveFaction(myFaction);
    }
  }, [myFaction]);

  const selectedUnit = selectedUnitId && gameState
    ? gameState.units[selectedUnitId]
    : null;

  const availableActions = useMemo(() => {
    if (!gameState || !selectedUnit || !commandingFaction) return [];
    return getAvailableActions(gameState, selectedUnit, commandingFaction);
  }, [gameState, selectedUnit, commandingFaction]);

  const pickMode = mapPickModeForDraft(orderDraft);

  const validNodeIds = useMemo(() => {
    if (!gameState || !selectedUnit || !orderDraft) return [];
    if (orderDraft.action === "move") {
      return getAdjacentNodes(gameState, selectedUnit.id);
    }
    if (orderDraft.action === "retreat") {
      return getRetreatTargets(gameState, selectedUnit);
    }
    if (
      orderDraft.action === "attack" &&
      orderDraft.attackIntention === "breakthrough"
    ) {
      return getAdjacentNodes(gameState, selectedUnit.id);
    }
    return [];
  }, [gameState, selectedUnit, orderDraft]);

  const pickableUnitIds = useMemo(() => {
    if (!gameState || !selectedUnit || !orderDraft) return [];
    if (pickMode === "enemy") {
      return getEnemiesOnNode(gameState, selectedUnit).map((u) => u.id);
    }
    if (pickMode === "ally") {
      return getAlliesOnNode(gameState, selectedUnit).map((u) => u.id);
    }
    return [];
  }, [gameState, selectedUnit, orderDraft, pickMode]);

  const clearOrder = useCallback(() => {
    setOrderDraft(null);
    setDraftIsNew(false);
    lastPersistedKey.current = null;
  }, []);

  const clearGroup = useCallback(() => {
    setGroupUnitIds([]);
    groupUnitIdsRef.current = [];
  }, []);

  // Keep ref in sync so closures in effects can read the latest group
  useEffect(() => {
    groupUnitIdsRef.current = groupUnitIds;
  }, [groupUnitIds]);

  // Intersection of available actions across all group units
  const groupAvailableActions = useMemo<ActionType[]>(() => {
    if (groupUnitIds.length === 0 || !gameState || !commandingFaction) return [];
    const sets = groupUnitIds.map((uid) => {
      const u = gameState.units[uid];
      if (!u) return new Set<ActionType>();
      return new Set(getAvailableActions(gameState, u, commandingFaction));
    });
    const first = sets[0];
    if (!first) return [];
    // Intersection — exclude cover since covering different allies per unit is confusing
    return [...first].filter(
      (a) => a !== "cover" && sets.every((s) => s.has(a))
    );
  }, [groupUnitIds, gameState, commandingFaction]);

  const showDebrief = useCallback(
    async (completedTurn: number, turnEvents: TurnEvent[], state: GameState) => {
      const res = await fetch(`/api/rooms/${roomId}/history`).catch(() => null);
      const availableTurns: number[] = res?.ok
        ? ((await res.json()) as { turns: number[] }).turns
        : [completedTurn];
      setDebrief({ completedTurn, events: turnEvents, availableTurns, initialState: state });
    },
    [roomId]
  );

  const handleTurnResolved = useCallback(
    (state: GameState, turnEvents: TurnEvent[]) => {
      setLocalState(state);
      setSelectedUnitId(null);
      setOrderDraft(null);
      clearGroup();
      submittedRef.current = false;
      refresh().then((snap) => {
        const resolved = snap ?? null;
        const completedTurn = state.turn - 1;
        if (completedTurn > 0) {
          const finalEvents = turnEvents.length > 0
            ? turnEvents
            : (resolved?.game?.lastTurnEvents ?? []);
          void showDebrief(completedTurn, finalEvents, state);
        }
      });
    },
    [refresh, showDebrief]
  );

  useSocket(roomId, refresh, handleTurnResolved, pushEvent);

  useEffect(() => {
    if (!snapshot?.game) return;
    const turn = snapshot.game.turn;
    setLocalState(snapshot.game.state);

    // Detect turn increment from polling (non-socket path)
    if (prevTurnRef.current !== null && turn > prevTurnRef.current) {
      submittedRef.current = false;
      const lastEvents = snapshot.game.lastTurnEvents ?? [];
      const completedTurn = turn - 1;
      void showDebrief(completedTurn, lastEvents, snapshot.game.state);
    }
    prevTurnRef.current = turn;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.game?.turn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { clearOrder(); clearGroup(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearOrder, clearGroup]);

  const persistOrder = useCallback(
    async (command: Command): Promise<boolean> => {
      const res = await fetch(`/api/rooms/${roomId}/orders`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (!res.ok) {
        const data = await res.json();
        pushEvent(data.error ?? "Order rejected");
        return false;
      }
      await refresh();
      return true;
    },
    [roomId, refresh, pushEvent]
  );

  useEffect(() => {
    if (!orderDraft || !isDraftComplete(orderDraft)) return;
    // Never auto-save after orders are locked
    if (submittedRef.current) return;

    const command = buildCommandFromDraft(orderDraft);
    const key = JSON.stringify(command);
    if (lastPersistedKey.current === key) return;

    const timer = window.setTimeout(async () => {
      if (submittedRef.current) return;
      const ok = await persistOrder(command);
      if (!ok) return;
      lastPersistedKey.current = key;
      // Apply same command to any remaining group units (with their own unitId)
      const groupIds = groupUnitIdsRef.current;
      if (groupIds.length > 1) {
        const others = groupIds.filter((id) => id !== command.unitId);
        for (const uid of others) {
          await persistOrder({ ...command, unitId: uid });
        }
        setGroupUnitIds([]);
        groupUnitIdsRef.current = [];
      }
      if (draftIsNew) {
        setOrderDraft(null);
        setDraftIsNew(false);
        lastPersistedKey.current = null;
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [orderDraft, draftIsNew, persistOrder]);

  async function handleSubmitTurn() {
    setSubmitting(true);
    submittedRef.current = true;
    try {
      const res = await fetch(`/api/rooms/${roomId}/submit`, { method: "POST" });
      const data = await res.json() as {
        ok?: boolean; error?: string; resolving?: boolean; resolved?: boolean;
        turn?: number; events?: TurnEvent[];
      };
      if (!res.ok) {
        submittedRef.current = false;
        throw new Error(data.error ?? "Submit failed");
      }

      if (data.resolving && data.resolved) {
        // Both players were ready — push events and show debrief
        const resolvedEvents = data.events ?? [];
        for (const e of resolvedEvents) {
          const msg = formatEvent(e);
          if (msg) pushEvent(msg);
        }
        const snap = await refresh();
        if (snap?.game?.state) {
          setLocalState(snap.game.state);
          setSelectedUnitId(null);
          clearOrder();
          submittedRef.current = false;
          const completedTurn = snap.game.turn - 1;
          if (completedTurn > 0) {
            const finalEvents = resolvedEvents.length > 0
              ? resolvedEvents
              : (snap.game.lastTurnEvents ?? []);
            void showDebrief(completedTurn, finalEvents, snap.game.state);
          }
        }
      } else {
        if (!data.resolving) pushEvent("Waiting for opponent…");
        await refresh();
      }
    } catch (e) {
      pushEvent(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteOrder(unitId: string) {
    if (submittedRef.current) return;
    await fetch(
      `/api/rooms/${roomId}/orders?unitId=${encodeURIComponent(unitId)}`,
      { method: "DELETE" }
    );
    if (editingUnitId === unitId) clearOrder();
    await refresh();
  }

  function handleSelectAll(nodeId: string) {
    if (!gameState || !commandingFaction || submittedRef.current) return;
    const nodeUnits = Object.values(gameState.units).filter(
      (u) => u.nodeId === nodeId && u.factionId === commandingFaction
    );
    if (nodeUnits.length < 2) return;
    clearGroup();
    clearOrder();
    setSelectedUnitId(null);
    const ids = nodeUnits.map((u) => u.id);
    setGroupUnitIds(ids);
    groupUnitIdsRef.current = ids;
  }

  function handlePickAction(action: ActionType) {
    const isGroup = groupUnitIds.length > 0;
    const leadId = isGroup ? groupUnitIds[0] : selectedUnitId;
    if (!leadId || !gameState) return;

    // Auto-complete actions — immediately create an order, no panel needed
    if (action === "dig_in" || action === "disengage") {
      if (isGroup) {
        for (const uid of groupUnitIds) {
          void persistOrder(buildCommandFromDraft(createDraft(action, uid)));
        }
        clearGroup();
      } else {
        void persistOrder(buildCommandFromDraft(createDraft(action, leadId)));
      }
      return;
    }

    // For group commands that need a target: use the first unit as the "lead"
    // The auto-save effect will propagate the finalized command to all other group units
    const lead = gameState.units[leadId];
    if (!lead) return;
    if (isGroup) setSelectedUnitId(leadId);

    const draft = createDraft(action, leadId);

    // Auto-select target when there's only one valid choice
    if (action === "move") {
      const adj = getAdjacentNodes(gameState, leadId);
      if (adj.length === 1) draft.targetNodeId = adj[0];
    } else if (action === "retreat") {
      const targets = getRetreatTargets(gameState, lead);
      if (targets.length === 1) draft.targetNodeId = targets[0];
    }

    lastPersistedKey.current = null;
    setDraftIsNew(true);
    setOrderDraft(draft);
  }

  function handleEditOrder(command: Command) {
    const draft = commandToDraft(command);
    if (!draft) return;
    lastPersistedKey.current = JSON.stringify(command);
    setDraftIsNew(false);
    setOrderDraft(draft);
    setSelectedUnitId(command.unitId);
  }

  function handleFactionChange(faction: string) {
    if (faction !== "rohan" && faction !== "isengard") return;
    setActiveFaction(faction);
    setSelectedUnitId(null);
    clearGroup();
    clearOrder();
  }

  function handleSelectUnit(unitId: string) {
    if (!gameState || !commandingFaction) return;
    const unit = gameState.units[unitId];
    if (!unit) return;

    if (orderDraft && pickMode === "enemy" && pickableUnitIds.includes(unitId)) {
      setOrderDraft({ ...orderDraft, targetUnitId: unitId });
      return;
    }
    if (orderDraft && pickMode === "ally" && pickableUnitIds.includes(unitId)) {
      setOrderDraft({ ...orderDraft, coverUnitId: unitId });
      return;
    }

    if (unit.factionId !== commandingFaction) return;

    // Clear group selection when switching to individual
    if (groupUnitIds.length > 0) clearGroup();

    if (orderDraft && unitId !== selectedUnitId) {
      clearOrder();
    }
    setSelectedUnitId(unitId);
  }

  function handleSelectNode(nodeId: string) {
    if (!orderDraft || !selectedUnit) return;

    if (pickMode === "destination" && validNodeIds.includes(nodeId)) {
      setOrderDraft({ ...orderDraft, targetNodeId: nodeId });
      return;
    }
    if (pickMode === "breakthrough" && validNodeIds.includes(nodeId)) {
      setOrderDraft({ ...orderDraft, breakthroughTargetNodeId: nodeId });
    }
  }

  const editingUnitId = orderDraft?.unitId ?? null;
  const panelUnit = selectedUnit ?? null;

  const turnEndsAt = snapshot?.game?.turnEndsAt;
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!turnEndsAt) return;
    const tick = () => {
      setSecondsLeft(
        Math.max(0, Math.floor((new Date(turnEndsAt).getTime() - Date.now()) / 1000))
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [turnEndsAt]);

  const minPlayers = soloDualFaction ? 1 : 2;
  const allReady =
    snapshot !== null &&
    snapshot.players.length >= minPlayers &&
    snapshot.readyPlayerIds.length >= snapshot.players.length;

  const waitingOnResolve =
    snapshot?.game?.phase === "planning" &&
    (secondsLeft === 0 || allReady);

  useEffect(() => {
    if (!waitingOnResolve) return;
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [waitingOnResolve, refresh]);

  // Must be declared before any early return so React's hook order is stable
  const battleNarratives = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of (snapshot?.game?.lastTurnEvents ?? [])) {
      if (e.type === "node_battle" && e.narrative) {
        m.set(e.nodeId, e.narrative);
      }
    }
    return m;
  }, [snapshot?.game?.lastTurnEvents]);

  const nodeNames = useMemo(
    () => (gameState ? nodeNameMap(gameState.map.nodes) : {}),
    [gameState]
  );

  if (!gameState || !snapshot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950">
        {roomError ? (
          <>
            <p className="text-sm font-medium text-red-400">Failed to load game</p>
            <p className="max-w-xs text-center text-xs text-slate-500">{roomError}</p>
            <a href="/" className="mt-2 text-xs text-amber-400 hover:underline">
              ← Return home
            </a>
          </>
        ) : (
          <p className="text-slate-400">{roomLoading ? "Loading game…" : "Connecting…"}</p>
        )}
      </main>
    );
  }

  const winner =
    snapshot.game?.winnerFactionId ?? gameState.meta.winnerFactionId;
  const resolving = allReady && !debrief && !winner;

  return (
    <>
      {winner && (
        <GameOver
          winner={winner}
          myFaction={commandingFaction ?? ""}
          turn={snapshot.game?.turn ?? gameState.turn}
        />
      )}
      {debrief && (
        <TurnDebrief
          completedTurn={debrief.completedTurn}
          events={debrief.events}
          initialState={debrief.initialState}
          roomId={roomId}
          availableTurns={debrief.availableTurns}
          onDismiss={() => {
            setDebrief(null);
            setSelectedUnitId(null);
            clearOrder();
          }}
        />
      )}
      <GameLayout
        header={
          <TurnHeader
            code={snapshot.room.code}
            turn={snapshot.game?.turn ?? gameState.turn}
            faction={commandingFaction ?? ""}
            secondsLeft={secondsLeft}
            mySubmitted={snapshot.mySubmitted}
            readyPlayerIds={snapshot.readyPlayerIds}
            totalPlayers={snapshot.players.length}
            winner={winner}
            resolving={resolving}
            onSubmit={handleSubmitTurn}
            submitting={submitting}
            soloDualFaction={soloDualFaction}
            activeFaction={activeFaction}
            onFactionChange={handleFactionChange}
          />
        }
        map={
          <MapView
            state={gameState}
            myFaction={commandingFaction}
            selectedUnitId={selectedUnitId}
            validNodeIds={validNodeIds}
            pickMode={pickMode}
            pickableUnitIds={pickableUnitIds}
            battleNarratives={battleNarratives}
            onSelectUnit={handleSelectUnit}
            onSelectNode={handleSelectNode}
            onSelectAll={snapshot.mySubmitted ? undefined : handleSelectAll}
            groupedUnitIds={groupUnitIds.length > 0 ? new Set(groupUnitIds) : undefined}
          />
        }
        sidebarHeader={
          groupUnitIds.length > 0 ? (
            <GroupInspector
              unitIds={groupUnitIds}
              gameState={gameState}
              nodeNames={nodeNames}
              onClear={clearGroup}
            />
          ) : (
            <UnitInspector
              unit={selectedUnit}
              nodeName={selectedUnit ? nodeNames[selectedUnit.nodeId] : undefined}
            />
          )
        }
        sidebarScroll={
          snapshot.mySubmitted ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center" style={{ fontFamily: "var(--font-mono), monospace" }}>
              <div style={{ color: "var(--color-gold)", fontSize: 20 }}>⊘</div>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>
                Orders Locked
              </p>
              <p className="text-[8px] uppercase tracking-wider" style={{ color: "#333" }}>
                Awaiting opponent confirmation
              </p>
            </div>
          ) : groupUnitIds.length > 0 && !orderDraft ? (
            <ActionPalette
              actions={groupAvailableActions}
              activeAction={null}
              onPick={handlePickAction}
            />
          ) : !orderDraft ? (
            <ActionPalette
              actions={availableActions}
              activeAction={null}
              onPick={handlePickAction}
            />
          ) : orderDraft && panelUnit ? (
            <CommandPanelBody
              draft={orderDraft}
              unit={panelUnit}
              state={gameState}
              autoSaveHint
              groupCount={groupUnitIds.length}
              onChange={(next) => {
                lastPersistedKey.current = null;
                setOrderDraft(next);
              }}
              onCancel={() => { clearOrder(); clearGroup(); }}
            />
          ) : null
        }
        orders={
          <OrderStrip
            orders={orders}
            state={gameState}
            editingUnitId={editingUnitId}
            locked={snapshot.mySubmitted}
            onSelect={handleEditOrder}
            onDelete={handleDeleteOrder}
          />
        }
        log={
          <EventLog
            events={events}
            open={logOpen}
            onToggle={() => setLogOpen((o) => !o)}
          />
        }
      />
    </>
  );
}
