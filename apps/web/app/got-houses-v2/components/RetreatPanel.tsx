"use client";

import type { Faction, GameAction, GameState, RetreatEntry } from "../types";
import { HOLDS_MAP } from "../data/holds";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  viewerFaction: Faction;
  twoBrowser?: boolean;
  /** Host (or solo) lands the picks. The joiner only chooses their own road. */
  canCommit?: boolean;
}

const FACTION_COLORS = {
  north: { text: "#6aaad8", border: "#1a3a5a" },
  westerlands: { text: "#d87070", border: "#5a1a1a" },
};

function chosenLabel(entry: RetreatEntry): string {
  if (entry.validTargets.length === 0) return "destroyed — no road left";
  if (!entry.chosenHoldId) return "choosing their road…";
  return HOLDS_MAP.get(entry.chosenHoldId)?.name ?? entry.chosenHoldId;
}

function RetreatRow({
  entry,
  armyName,
  armyFaction,
  interactive,
  viewerFaction,
  dispatch,
}: {
  entry: RetreatEntry;
  armyName: string;
  armyFaction: Faction;
  interactive: boolean;
  viewerFaction: Faction;
  dispatch: React.Dispatch<GameAction>;
}) {
  const colors = FACTION_COLORS[armyFaction];
  const fromHold = HOLDS_MAP.get(entry.fromHoldId);

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        background: "#0a0a0a",
        padding: "10px 14px",
        marginBottom: 8,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: colors.text,
          }}
        >
          {armyName}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            color: "#555",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginLeft: 8,
          }}
        >
          must retreat from {fromHold?.name ?? entry.fromHoldId}
        </span>
      </div>

      {!interactive ? (
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            color: entry.chosenHoldId ? colors.text : "#666",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {chosenLabel(entry)}
        </div>
      ) : (
        <>
          {entry.forbiddenHoldIds.length > 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 8,
                color: "#4a1a1a",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Cannot retreat to:{" "}
              {entry.forbiddenHoldIds
                .map((id) => HOLDS_MAP.get(id)?.name ?? id)
                .join(", ")}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {entry.validTargets.length === 0 ? (
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 9,
                  color: "#e05555",
                }}
              >
                No valid retreat — army is destroyed
              </span>
            ) : (
              entry.validTargets.map((holdId) => {
                const hold = HOLDS_MAP.get(holdId);
                const chosen = entry.chosenHoldId === holdId;
                return (
                  <button
                    key={holdId}
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "SET_RETREAT",
                        armyId: entry.armyId,
                        toHoldId: holdId,
                        asFaction: viewerFaction,
                      })
                    }
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 9,
                      fontWeight: chosen ? 700 : 400,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "4px 10px",
                      cursor: "pointer",
                      border: chosen ? `1px solid ${colors.text}` : "1px solid #2a2a2a",
                      background: chosen ? `${colors.text}18` : "#080808",
                      color: chosen ? colors.text : "#666",
                      transition: "border-color 0.12s, color 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!chosen) {
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.color = colors.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!chosen) {
                        e.currentTarget.style.borderColor = "#2a2a2a";
                        e.currentTarget.style.color = "#666";
                      }
                    }}
                  >
                    {chosen ? "✓ " : ""}
                    {hold?.name ?? holdId}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function RetreatPanel({
  state,
  dispatch,
  viewerFaction,
  twoBrowser,
  canCommit = true,
}: Props) {
  const { retreats, armies, turn, adminMode } = state;
  const pickAll = !twoBrowser && adminMode;

  const mine = retreats.filter((entry) => {
    const army = armies.find((a) => a.id === entry.armyId);
    return army && (pickAll || army.faction === viewerFaction);
  });
  const theirs = retreats.filter((entry) => {
    const army = armies.find((a) => a.id === entry.armyId);
    return army && !pickAll && army.faction !== viewerFaction;
  });

  const mineChosen = mine.every(
    (r) => r.chosenHoldId !== null || r.validTargets.length === 0
  );
  const allChosen = retreats.every(
    (r) => r.chosenHoldId !== null || r.validTargets.length === 0
  );
  const waitingOnRival = theirs.some(
    (r) => r.chosenHoldId === null && r.validTargets.length > 0
  );

  let footer = "Select all destinations to continue";
  if (canCommit && allChosen) {
    footer = "Confirm Retreats — Begin Turn " + (turn + 1);
  } else if (!canCommit && mineChosen) {
    footer = waitingOnRival
      ? "Waiting for the other side to choose…"
      : "Waiting for the host to continue…";
  } else if (canCommit && mineChosen && waitingOnRival) {
    footer = "Waiting for the other side to choose their road…";
  } else if (!mineChosen) {
    footer = "Choose where your beaten hosts fall back";
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid #3a2a00",
          background: "#0d0d0d",
          boxShadow: "0 0 40px rgba(200,148,26,0.1)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1e1e1e",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#c8941a",
              marginBottom: 4,
            }}
          >
            Retreat Phase — Turn {turn}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#555",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {mine.length > 0
              ? "Your beaten hosts must fall back. Only you choose their road."
              : "The other side is choosing where their beaten hosts fall back."}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {mine.map((entry) => {
            const army = armies.find((a) => a.id === entry.armyId);
            if (!army) return null;
            return (
              <RetreatRow
                key={entry.armyId}
                entry={entry}
                armyName={army.name}
                armyFaction={army.faction}
                interactive
                viewerFaction={viewerFaction}
                dispatch={dispatch}
              />
            );
          })}
          {theirs.length > 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 8,
                color: "#444",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                margin: mine.length > 0 ? "12px 0 8px" : "0 0 8px",
              }}
            >
              The other side
            </div>
          )}
          {theirs.map((entry) => {
            const army = armies.find((a) => a.id === entry.armyId);
            if (!army) return null;
            return (
              <RetreatRow
                key={entry.armyId}
                entry={entry}
                armyName={army.name}
                armyFaction={army.faction}
                interactive={false}
                viewerFaction={viewerFaction}
                dispatch={dispatch}
              />
            );
          })}
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1e1e1e",
            flexShrink: 0,
          }}
        >
          {canCommit ? (
            <button
              type="button"
              disabled={!allChosen}
              onClick={() => dispatch({ type: "COMMIT_RETREATS" })}
              style={{
                width: "100%",
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                padding: "10px",
                cursor: allChosen ? "pointer" : "default",
                border: allChosen ? "1px solid #c8941a" : "1px solid #2a2a2a",
                background: allChosen ? "#1a1200" : "#080808",
                color: allChosen ? "#c8941a" : "#333",
                transition: "border-color 0.12s, color 0.12s",
              }}
            >
              {footer}
            </button>
          ) : (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#666",
                textAlign: "center",
                padding: "8px 0",
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
