"use client";

import type { GameAction, GameState, PrisonerGroup } from "../types";
import { HOLDS_MAP } from "../data/holds";
import { prisonerMen } from "../lib/prisoners";

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono), monospace" };

interface Props {
  group: PrisonerGroup;
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export default function PrisonerCard({ group, state, dispatch }: Props) {
  const men = prisonerMen(group);
  const names = group.characterIds
    .map((id) => state.characters[id]?.name)
    .filter(Boolean);
  const taken = HOLDS_MAP.get(group.takenAtHoldId)?.name ?? group.takenAtHoldId;
  const loc = group.location;
  const armiesHere =
    loc.kind === "hold"
      ? state.armies.filter(
          (a) => a.holdId === loc.holdId && a.faction === group.captorFaction
        )
      : [];
  const holdId =
    loc.kind === "hold"
      ? loc.holdId
      : state.armies.find((a) => a.id === loc.armyId)?.holdId;

  return (
    <div className="mt-2 min-w-0 overflow-hidden" style={{
        border: "1px solid #4a2010",
        background: "#120804",
        padding: "8px 9px",
      }}>
      <div style={{ ...MONO, fontSize: 8, color: "#a06030", letterSpacing: "0.12em" }}>
        PRISONERS
      </div>
      <div className="mt-0.5 break-words font-mono text-[11px] text-[#d0b090]">
        {men > 0 ? `${men.toLocaleString()} men` : "Named captives"}
        {names.length > 0 ? ` — ${names.join(", ")}` : ""}
      </div>
      <div className="mt-0.5 break-words font-mono text-[8px] uppercase tracking-wider text-[#6a5030]">
        Taken at {taken}, turn {group.takenTurn}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <Small
          label="Release"
          onClick={() =>
            dispatch({ type: "DISPOSE_PRISONERS", groupId: group.id, action: "release" })
          }
        />
        <Small
          label="Execute"
          danger
          onClick={() =>
            dispatch({ type: "DISPOSE_PRISONERS", groupId: group.id, action: "execute" })
          }
        />
        {group.location.kind === "army" && holdId && (
          <Small
            label="Leave in castle"
            onClick={() =>
              dispatch({
                type: "MOVE_PRISONERS",
                groupId: group.id,
                to: { kind: "hold", holdId },
              })
            }
          />
        )}
        {armiesHere.map((a) => (
          <Small
            key={a.id}
            label={`Attach to ${a.name}`}
            onClick={() =>
              dispatch({
                type: "MOVE_PRISONERS",
                groupId: group.id,
                to: { kind: "army", armyId: a.id },
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function Small({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...MONO,
        fontSize: 8,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: danger ? "#d07050" : "#c8b88a",
        background: danger ? "#170a04" : "#0e0e0e",
        border: `1px solid ${danger ? "#4a2010" : "#2a2418"}`,
        padding: "4px 7px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
