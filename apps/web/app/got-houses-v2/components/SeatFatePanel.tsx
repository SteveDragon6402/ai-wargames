"use client";

import { useEffect, useState } from "react";
import type {
  Faction,
  GameAction,
  GameState,
  PersonFate,
  PrisonerLocation,
  TownFate,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { describeTerms } from "../lib/terms";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono), monospace" };

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  viewerFaction?: Faction;
  /** Render inside the sidebar instead of a floating card. */
  embedded?: boolean;
  holdId?: string;
}

export default function SeatFatePanel({
  state,
  dispatch,
  viewerFaction,
  embedded,
  holdId,
}: Props) {
  const found = (state.pendingChoices ?? []).find((c) =>
    holdId
      ? c.holdId === holdId && (!viewerFaction || c.faction === viewerFaction)
      : c.id === state.seatFatePanelId
  );
  const choice =
    found && (!viewerFaction || found.faction === viewerFaction) ? found : null;
  const escorts = choice?.escortArmyIds ?? [];

  const [garrison, setGarrison] = useState<PersonFate>("prisoner");
  const [leaders, setLeaders] = useState<PersonFate>("prisoner");
  const [town, setTown] = useState<TownFate>("occupy");
  const [dest, setDest] = useState<PrisonerLocation>({
    kind: "hold",
    holdId: "",
  });

  useEffect(() => {
    if (!choice) return;
    setGarrison(choice.promised?.garrison ?? "prisoner");
    setLeaders(choice.promised?.leaders ?? "prisoner");
    setTown(choice.promised?.town ?? "occupy");
    const ids = choice.escortArmyIds ?? [];
    setDest(
      ids[0]
        ? { kind: "army", armyId: ids[0] }
        : { kind: "hold", holdId: choice.holdId }
    );
  }, [choice?.id]);

  if (!choice) return null;

  const holdName = HOLDS_MAP.get(choice.holdId)?.name ?? choice.holdId;

  const needsDest = garrison === "prisoner" || leaders === "prisoner";

  return (
    <div
      style={
        embedded
          ? {
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              background: "#0d0b06",
              border: "1px solid #c8941a",
              padding: 10,
            }
          : {
              position: "fixed",
              right: 16,
              top: 72,
              width: 320,
              zIndex: 70,
              background: "#0d0b06",
              border: "1px solid #c8941a",
              padding: 12,
            }
      }
    >
      <div style={{ ...MONO, fontSize: 8, color: "#c8941a", letterSpacing: "0.12em" }}>
        {(choice.headline ?? "Seat fate").toUpperCase()}
      </div>
      <div style={{ ...MONO, fontSize: 11, color: "#c8b88a", marginTop: 4 }}>
        {holdName}
      </div>
      {choice.promised && (
        <div style={{ ...MONO, fontSize: 9, color: "#7a6a3a", marginTop: 6 }}>
          Promised: {describeTerms({ ...choice.promised, offeredBy: choice.faction, note: "", offeredTurn: 0, expiresTurn: 0, status: "accepted" })}
        </div>
      )}

      <Axis label="Garrison" value={garrison} onChange={setGarrison} />
      <Axis label="Captains" value={leaders} onChange={setLeaders} />
      {choice.kind === "seat_fate" && (
        <div style={{ ...MONO, fontSize: 9, color: "#8a7a5a", marginTop: 8 }}>
          Town
          <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
            {(["occupy", "raze"] as TownFate[]).map((f) => (
              <label key={f} style={{ color: town === f ? "#c8b88a" : "#555", cursor: "pointer" }}>
                <input type="radio" checked={town === f} onChange={() => setTown(f)} style={{ accentColor: "#c8941a", marginRight: 4 }} />
                {f}
              </label>
            ))}
          </div>
        </div>
      )}

      {needsDest && (
        <div style={{ ...MONO, fontSize: 9, color: "#8a7a5a", marginTop: 8 }}>
          Hold the captives
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 3 }}>
            <label style={{ color: dest.kind === "hold" ? "#c8b88a" : "#555", cursor: "pointer" }}>
              <input
                type="radio"
                checked={dest.kind === "hold"}
                onChange={() => setDest({ kind: "hold", holdId: choice.holdId })}
                style={{ accentColor: "#c8941a", marginRight: 4 }}
              />
              Leave in {holdName}
            </label>
            {escorts.map((id) => {
              const army = state.armies.find((a) => a.id === id);
              return (
                <label key={id} style={{ color: dest.kind === "army" && dest.armyId === id ? "#c8b88a" : "#555", cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={dest.kind === "army" && dest.armyId === id}
                    onChange={() => setDest({ kind: "army", armyId: id })}
                    style={{ accentColor: "#c8941a", marginRight: 4 }}
                  />
                  Attach to {army?.name ?? id}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "RESOLVE_PENDING_CHOICE",
              choiceId: choice.id,
              fates: { garrison, leaders, town },
              prisonerDestination: needsDest ? dest : null,
            })
          }
          style={{
            ...MONO,
            fontSize: 9,
            textTransform: "uppercase",
            color: "#0d0b06",
            background: "#c8941a",
            border: "none",
            padding: "7px 10px",
            cursor: "pointer",
          }}
        >
          Confirm
        </button>
        {!embedded && (
        <button
          type="button"
          onClick={() => dispatch({ type: "OPEN_SEAT_FATE_PANEL", choiceId: null })}
          style={{
            ...MONO,
            fontSize: 9,
            color: "#888",
            background: "transparent",
            border: "1px solid #333",
            padding: "7px 10px",
            cursor: "pointer",
          }}
        >
          Later
        </button>
        )}
      </div>
    </div>
  );
}

function Axis({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PersonFate;
  onChange: (v: PersonFate) => void;
}) {
  return (
    <div style={{ ...MONO, fontSize: 9, color: "#8a7a5a", marginTop: 8 }}>
      {label}
      <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
        {(["let_go", "prisoner", "execute"] as PersonFate[]).map((f) => (
          <label key={f} style={{ color: value === f ? "#c8b88a" : "#555", cursor: "pointer" }}>
            <input type="radio" checked={value === f} onChange={() => onChange(f)} style={{ accentColor: "#c8941a", marginRight: 4 }} />
            {f === "let_go" ? "let walk" : f === "prisoner" ? "hold" : "execute"}
          </label>
        ))}
      </div>
    </div>
  );
}
