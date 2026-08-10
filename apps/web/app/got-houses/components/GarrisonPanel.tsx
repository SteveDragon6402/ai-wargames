"use client";

import { useState } from "react";
import type {
  Army,
  ArmyUnit,
  Faction,
  GameAction,
  GameState,
  GarrisonTransfer,
} from "../types";
import { getCastleSeed } from "../data/castles";
import {
  freeCapacity,
  garrisonHeadcount,
  isFriendlyTo,
} from "../lib/hold-runtime";
import { HOLDS_MAP } from "../data/holds";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono), monospace" };

function unitKey(u: ArmyUnit): string {
  return `${u.house}|${u.type}`;
}

export default function GarrisonPanel({ state, dispatch }: Props) {
  const panel = state.garrisonPanel;
  if (!panel) return null;
  const army = panel.armyId
    ? state.armies.find((a) => a.id === panel.armyId) ?? null
    : null;
  const hs = state.holdStates?.[panel.holdId];
  if (!hs) return null;
  // Deposit / abandon require a field army; withdraw may form a new host
  if ((panel.mode === "deposit" || panel.mode === "abandon") && !army) {
    return null;
  }

  return (
    <GarrisonPanelInner
      army={army}
      holdId={panel.holdId}
      mode={panel.mode}
      state={state}
      dispatch={dispatch}
    />
  );
}

function GarrisonPanelInner({
  army,
  holdId,
  mode,
  state,
  dispatch,
}: {
  army: Army | null;
  holdId: string;
  mode: "deposit" | "withdraw" | "abandon";
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const hs = state.holdStates[holdId]!;
  const seed = getCastleSeed(holdId);
  const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
  const faction: Faction =
    army?.faction ??
    (hs.controller === "north" || hs.controller === "westerlands"
      ? hs.controller
      : state.activeFaction);

  const sourceUnits =
    mode === "deposit" ? army!.units : hs.garrison.units;
  const sourceLeaders =
    mode === "deposit" ? army!.leaders : hs.garrison.leaders;
  const sourceNotables =
    mode === "deposit"
      ? army!.notables ?? []
      : hs.garrison.notables ?? [];

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const u of sourceUnits) init[unitKey(u)] = 0;
    return init;
  });
  const [leaderOn, setLeaderOn] = useState<Record<string, boolean>>({});
  const [notableOn, setNotableOn] = useState<Record<string, boolean>>({});

  const selectedUnits: ArmyUnit[] = sourceUnits
    .map((u) => ({ ...u, count: counts[unitKey(u)] ?? 0 }))
    .filter((u) => u.count > 0);
  const takeMen = selectedUnits.reduce((s, u) => s + u.count, 0);
  const leaderNames = sourceLeaders
    .filter((l) => leaderOn[l.name])
    .map((l) => l.name);
  const notableNames = sourceNotables
    .filter((n) => notableOn[n.name])
    .map((n) => n.name);

  const free = freeCapacity(holdId, hs);
  const currentMen = garrisonHeadcount(hs.garrison);
  const floor =
    mode === "withdraw" && isFriendlyTo(hs, faction)
      ? seed.defaultGarrison
      : 0;
  const maxWithdraw = Math.max(0, currentMen - floor);

  let canConfirm = takeMen > 0 || leaderNames.length > 0 || notableNames.length > 0;
  if (mode === "deposit" && takeMen > free) canConfirm = false;
  if (mode === "withdraw" && takeMen > maxWithdraw) canConfirm = false;

  function handleConfirm() {
    if (!canConfirm) return;
    if (mode === "abandon") {
      if (!army) return;
      dispatch({ type: "ABANDON_HOLD", holdId, armyId: army.id });
      return;
    }
    const transfer: GarrisonTransfer = {
      holdId,
      armyId: army?.id ?? null,
      mode,
      units: selectedUnits,
      leaderNames,
      notableNames,
    };
    dispatch({ type: "GARRISON_TRANSFER", transfer });
  }

  if (mode === "abandon") {
    return (
      <Overlay>
        <Header
          title={`Abandon ${holdName}`}
          onClose={() => dispatch({ type: "CLOSE_GARRISON_PANEL" })}
        />
        <p style={{ ...MONO, fontSize: 10, color: "#888", margin: "12px 0" }}>
          Withdraw the entire garrison ({currentMen.toLocaleString()} men). The
          seat returns to its home faction and refills to the default garrison.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn
            label="Confirm abandon"
            onClick={() =>
              army &&
              dispatch({ type: "ABANDON_HOLD", holdId, armyId: army.id })
            }
            accent
          />
          <Btn
            label="Cancel"
            onClick={() => dispatch({ type: "CLOSE_GARRISON_PANEL" })}
          />
        </div>
      </Overlay>
    );
  }

  const title =
    mode === "deposit"
      ? `Garrison → ${holdName}`
      : army
        ? `Ungarrison → ${army.name}`
        : `Ungarrison → new host at ${holdName}`;

  return (
    <Overlay>
      <Header
        title={title}
        onClose={() => dispatch({ type: "CLOSE_GARRISON_PANEL" })}
      />
      {mode === "withdraw" && !army && (
        <p style={{ ...MONO, fontSize: 10, color: "#888", margin: "8px 0 0" }}>
          No field army selected — extras will form a new host outside the
          gates (floor {floor.toLocaleString()}).
        </p>
      )}
      <p style={{ ...MONO, fontSize: 10, color: "#666", margin: "8px 0 12px" }}>
        {mode === "deposit"
          ? `Capacity free: ${free.toLocaleString()}`
          : `Can withdraw up to ${maxWithdraw.toLocaleString()} (floor ${floor.toLocaleString()})`}
      </p>

      <Section label="Troops">
        {sourceUnits.map((u) => {
          const key = unitKey(u);
          const max =
            mode === "withdraw"
              ? Math.min(u.count, maxWithdraw)
              : u.count;
          return (
            <Row key={key}>
              <span style={{ flex: 1 }}>
                {u.house} {u.type} ({u.count.toLocaleString()})
              </span>
              <input
                type="number"
                min={0}
                max={max}
                value={counts[key] ?? 0}
                onChange={(e) =>
                  setCounts((c) => ({
                    ...c,
                    [key]: Math.max(
                      0,
                      Math.min(max, Number(e.target.value) || 0)
                    ),
                  }))
                }
                style={{
                  width: 64,
                  background: "#111",
                  border: "1px solid #333",
                  color: "#ccc",
                  fontSize: 11,
                  padding: "2px 4px",
                  ...MONO,
                }}
              />
            </Row>
          );
        })}
      </Section>

      {sourceLeaders.length > 0 && (
        <Section label="Leaders">
          {sourceLeaders.map((l) => (
            <label
              key={l.name}
              style={{
                ...MONO,
                fontSize: 11,
                color: "#aaa",
                display: "flex",
                gap: 8,
                marginBottom: 4,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={!!leaderOn[l.name]}
                onChange={(e) =>
                  setLeaderOn((s) => ({ ...s, [l.name]: e.target.checked }))
                }
              />
              {l.name}
            </label>
          ))}
        </Section>
      )}

      {sourceNotables.length > 0 && (
        <Section label="Notables">
          {sourceNotables.map((n) => (
            <label
              key={n.name}
              style={{
                ...MONO,
                fontSize: 11,
                color: "#aaa",
                display: "flex",
                gap: 8,
                marginBottom: 4,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={!!notableOn[n.name]}
                onChange={(e) =>
                  setNotableOn((s) => ({ ...s, [n.name]: e.target.checked }))
                }
              />
              {n.name}
            </label>
          ))}
        </Section>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn label="Confirm" onClick={handleConfirm} accent disabled={!canConfirm} />
        <Btn
          label="Cancel"
          onClick={() => dispatch({ type: "CLOSE_GARRISON_PANEL" })}
        />
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "90vh",
          overflow: "auto",
          background: "#0c0c0c",
          border: "1px solid #2a2a2a",
          padding: 16,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
      }}
    >
      <div
        style={{
          ...MONO,
          fontSize: 12,
          color: "#c8941a",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          ...MONO,
          fontSize: 10,
          color: "#666",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          ...MONO,
          fontSize: 8,
          color: "#555",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...MONO,
        fontSize: 11,
        color: "#aaa",
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function Btn({
  label,
  onClick,
  accent,
  disabled,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...MONO,
        fontSize: 10,
        padding: "6px 12px",
        border: accent ? "1px solid #c8941a" : "1px solid #333",
        background: accent ? "#1a1408" : "#111",
        color: disabled ? "#444" : accent ? "#c8941a" : "#aaa",
        cursor: disabled ? "default" : "pointer",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {label}
    </button>
  );
}
