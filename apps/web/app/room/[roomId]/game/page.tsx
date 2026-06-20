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

  const handleTurnResolved = useCallback(
    (state: GameState) => {
      setLocalState(state);
      setSelectedUnitId(null);
      setOrderDraft(null);
      refresh();
    },
    [refresh]
  );

  useSocket(roomId, refresh, handleTurnResolved, pushEvent);

  useEffect(() => {
    if (snapshot?.game?.state) setLocalState(snapshot.game.state);
  }, [snapshot?.game?.state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearOrder();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearOrder]);

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

    const command = buildCommandFromDraft(orderDraft);
    const key = JSON.stringify(command);
    if (lastPersistedKey.current === key) return;

    const timer = window.setTimeout(async () => {
      const ok = await persistOrder(command);
      if (!ok) return;
      lastPersistedKey.current = key;
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
    try {
      const res = await fetch(`/api/rooms/${roomId}/submit`, { method: "POST" });
      const data = await res.json() as {
        ok?: boolean; error?: string; resolving?: boolean; resolved?: boolean;
        turn?: number; events?: TurnEvent[];
      };
      if (!res.ok) throw new Error(data.error ?? "Submit failed");

      if (data.resolving) {
        if (data.resolved) {
          // Turn resolved inline (solo mode) — push battle events from response
          for (const e of data.events ?? []) {
            const msg = formatEvent(e);
            if (msg) pushEvent(msg);
          }
        } else {
          pushEvent("Turn resolving…");
        }
      } else {
        pushEvent("Waiting for opponent");
      }

      const snap = await refresh();
      if (snap?.game?.state) {
        setLocalState(snap.game.state);
        setSelectedUnitId(null);
        clearOrder();
      }
    } catch (e) {
      pushEvent(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteOrder(unitId: string) {
    await fetch(
      `/api/rooms/${roomId}/orders?unitId=${encodeURIComponent(unitId)}`,
      { method: "DELETE" }
    );
    if (editingUnitId === unitId) clearOrder();
    await refresh();
  }

  function handlePickAction(action: ActionType) {
    if (!selectedUnit) return;
    if (action === "abandon_capital") {
      void persistOrder({ type: "abandon_capital" });
      return;
    }
    const draft = createDraft(action, selectedUnit.id);
    if (action === "dig_in" || action === "disengage") {
      void persistOrder(buildCommandFromDraft(draft));
      return;
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
    if (command.type !== "abandon_capital") {
      setSelectedUnitId(command.unitId);
    }
  }

  function handleFactionChange(faction: string) {
    if (faction !== "rohan" && faction !== "isengard") return;
    setActiveFaction(faction);
    setSelectedUnitId(null);
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
  const panelUnit =
    selectedUnit ??
    (orderDraft?.action === "abandon_capital" && commandingFaction && gameState
      ? Object.values(gameState.units).find((u) => u.factionId === commandingFaction)
      : null);

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

  const waitingOnResolve =
    snapshot?.game?.phase === "planning" &&
    (secondsLeft === 0 ||
      (snapshot.readyPlayerIds.length >= snapshot.players.length &&
        snapshot.players.length >= (soloDualFaction ? 1 : 2)));

  useEffect(() => {
    if (!waitingOnResolve) return;
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [waitingOnResolve, refresh]);

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
  const nodeNames = nodeNameMap(gameState.map.nodes);

  return (
    <>
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
            onSelectUnit={handleSelectUnit}
            onSelectNode={handleSelectNode}
          />
        }
        sidebarHeader={
          <UnitInspector
            unit={selectedUnit}
            nodeName={selectedUnit ? nodeNames[selectedUnit.nodeId] : undefined}
          />
        }
        sidebarScroll={
          !orderDraft ? (
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
              onChange={(next) => {
                lastPersistedKey.current = null;
                setOrderDraft(next);
              }}
              onCancel={clearOrder}
            />
          ) : null
        }
        orders={
          <OrderStrip
            orders={orders}
            state={gameState}
            editingUnitId={editingUnitId}
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
