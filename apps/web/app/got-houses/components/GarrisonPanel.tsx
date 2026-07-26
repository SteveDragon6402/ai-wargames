"use client";

import { useState } from "react";
import type {
  Army,
  ArmyUnit,
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
  const army = state.armies.find((a) => a.id === panel.armyId);
  const hs = state.holdStates?.[panel.holdId];
  if (!army || !hs) return null;

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
  army: Army;
  holdId: string;
  mode: "deposit" | "withdraw" | "abandon";
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const hs = state.holdStates[holdId]!;
  const seed = getCastleSeed(holdId);
  const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
  const sourceUnits =
    mode === "deposit" ? army.units : hs.garrison.units;
  const sourceLeaders =
    mode === "deposit" ? army.leaders : hs.garrison.leaders;
  const sourceNotables =
    mode === "deposit"
      ? army.notables ?? []
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
    mode === "withdraw" && isFriendlyTo(hs, army.faction)
      ? seed.defaultGarrison
      : 0;
  const maxWithdraw = Math.max(0, currentMen - floor);

  let canConfirm = takeMen > 0 || leaderNames.length > 0 || notableNames.length > 0;
  if (mode === "deposit" && takeMen > free) canConfirm = false;
  if (mode === "withdraw" && takeMen > maxWithdraw) canConfirm = false;

  function handleConfirm() {
    if (!canConfirm) return;
    if (mode === "abandon") {
      dispatch({ type: "ABANDON_HOLD", holdId, armyId: army.id });
      return;
    }
    const transfer: GarrisonTransfer = {
      holdId,
      armyId: army.id,
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

  return (
    <Overlay>
      <Header
        title={
          mode === "deposit"
            ? `Garrison → ${holdName}`
            : `Ungarrison ← ${holdName}`
        }
        onClose={() => dispatch({ type: "CLOSE_GARRISON_PANEL" })}
      />
      <p style={{ ...MONO, fontSize: 9, color: "#555", margin: "0 0 10px" }}>
        {mode === "deposit"
          ? `Free capacity ${free.toLocaleString()} · default ${seed.defaultGarrison.toLocaleString()} · capacity ${seed.capacity.toLocaleString()}`
          : `May withdraw down to default ${floor.toLocaleString()} (${maxWithdraw.toLocaleString()} free to pull)`}
      </p>

      <div style={{ ...MONO, fontSize: 9, color: "#888", marginBottom: 6 }}>
        Units
      </div>
      {sourceUnits.map((u) => {
        const key = unitKey(u);
        const max =
          mode === "deposit"
            ? u.count
            : Math.min(u.count, maxWithdraw);
        return (
          <Row key={key} label={`${u.count.toLocaleString()} ${u.house} ${u.type}`}>
            <input
              type="range"
              min={0}
              max={max}
              value={counts[key] ?? 0}
              onChange={(e) =>
                setCounts((c) => ({ ...c, [key]: Number(e.target.value) }))
              }
              style={{ flex: 1 }}
            />
            <span style={{ ...MONO, fontSize: 9, color: "#c8941a", width: 36 }}>
              {counts[key] ?? 0}
            </span>
          </Row>
        );
      })}

      {sourceLeaders.length > 0 && (
        <>
          <div style={{ ...MONO, fontSize: 9, color: "#888", margin: "10px 0 6px" }}>
            Commanders
          </div>
          {sourceLeaders.map((l) => (
            <label
              key={l.name}
              style={{
                ...MONO,
                fontSize: 10,
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
        </>
      )}

      {sourceNotables.length > 0 && (
        <>
          <div style={{ ...MONO, fontSize: 9, color: "#888", margin: "10px 0 6px" }}>
            Notables
          </div>
          {sourceNotables.map((n) => (
            <label
              key={n.name}
              style={{
                ...MONO,
                fontSize: 10,
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
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Btn
          label={mode === "deposit" ? "Deposit" : "Withdraw"}
          onClick={handleConfirm}
          disabled={!canConfirm}
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
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#0c0c0c",
          border: "1px solid #2a2a2a",
          padding: 18,
          width: "100%",
          maxWidth: 420,
          maxHeight: "90vh",
          overflow: "auto",
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
        marginBottom: 8,
      }}
    >
      <span
        style={{
          ...MONO,
          fontSize: 11,
          fontWeight: 700,
          color: "#c8941a",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {title}
      </span>
      <button
        type="button"
        onClick={onClose}
        style={{
          ...MONO,
          fontSize: 10,
          color: "#444",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
      }}
    >
      <span style={{ ...MONO, fontSize: 9, color: "#777", width: 140 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Btn({
  label,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...MONO,
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        padding: "6px 12px",
        cursor: disabled ? "default" : "pointer",
        border: accent ? "1px solid #3a2a00" : "1px solid #2a2a2a",
        background: accent ? "#1a1200" : "#0a0a0a",
        color: disabled ? "#333" : accent ? "#c8941a" : "#888",
      }}
    >
      {label}
    </button>
  );
}
