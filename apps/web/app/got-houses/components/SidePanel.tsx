"use client";

import type { GameState, GameAction, Army, Faction } from "../types";
import { HOLDS_MAP } from "../data/holds";
import ArmyCard from "./ArmyCard";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const FACTION_LABEL: Record<Faction, string> = {
  north: "The North",
  westerlands: "The Westerlands",
};

export default function SidePanel({ state, dispatch }: Props) {
  const { selectedHoldId, selectedArmyIds, moveMode, armies, activeFaction, adminMode } = state;

  if (!selectedHoldId) {
    return (
      <div
        style={{
          width: 320,
          flexShrink: 0,
          borderLeft: "1px solid #1e1e1e",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            color: "#2a2a2a",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            textAlign: "center",
            padding: "0 24px",
          }}
        >
          Select a hold on the map
        </p>
      </div>
    );
  }

  const hold = HOLDS_MAP.get(selectedHoldId);
  if (!hold) return null;

  const armiesHere = armies.filter((a) => a.holdId === selectedHoldId);
  const northHere = armiesHere.filter((a) => a.faction === "north");
  const westHere = armiesHere.filter((a) => a.faction === "westerlands");

  const selectedArmies = selectedArmyIds
    .map((id) => armies.find((a) => a.id === id))
    .filter(Boolean) as Army[];

  const allSelectedSameFaction = selectedArmies.every(
    (a) => a.faction === selectedArmies[0]?.faction
  );
  const selectedFaction: Faction | null =
    selectedArmies.length > 0 && allSelectedSameFaction
      ? selectedArmies[0].faction
      : null;

  const factionOrders =
    selectedFaction === "north"
      ? state.north
      : selectedFaction === "westerlands"
        ? state.westerlands
        : null;
  const isLocked = factionOrders?.submitted ?? false;

  // Determine if "Select all here" should be shown for active faction
  const controllableArmies = armiesHere.filter((a) => {
    if (!adminMode && a.faction !== activeFaction) return false;
    const orders = a.faction === "north" ? state.north : state.westerlands;
    return !orders.submitted;
  });
  const allControllableSelected =
    controllableArmies.length > 0 &&
    controllableArmies.every((a) => selectedArmyIds.includes(a.id));

  // Can combine: 2+ selected, same hold, same faction, not locked
  const canCombine =
    selectedArmies.length >= 2 &&
    selectedArmies.every((a) => a.holdId === selectedHoldId) &&
    allSelectedSameFaction &&
    !isLocked;

  // Can move: 1+ selected, not locked, not already in move mode
  const canMove = selectedArmies.length > 0 && !isLocked;

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: "1px solid #1e1e1e",
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Hold header */}
      <div
        style={{
          borderBottom: "1px solid #1e1e1e",
          padding: "10px 14px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#c8941a",
            }}
          >
            {hold.name}
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: "SELECT_HOLD", holdId: null })}
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 10,
              color: "#333",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
          >
            ✕
          </button>
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
          {hold.house} · {hold.region}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            color: "#444",
            marginTop: 2,
            fontStyle: "italic",
          }}
        >
          {hold.lord}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 8,
            color: "#333",
            marginTop: 4,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Links: {hold.links.map((id) => HOLDS_MAP.get(id)?.name ?? id).join(", ")}
        </div>
      </div>

      {/* Action bar */}
      {selectedArmies.length > 0 && (
        <div
          style={{
            borderBottom: "1px solid #1e1e1e",
            padding: "8px 14px",
            flexShrink: 0,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {!moveMode.active ? (
            <>
              <ActionButton
                label="Move"
                disabled={!canMove}
                onClick={() => dispatch({ type: "BEGIN_MOVE" })}
                accent
              />
              {canCombine && (
                <ActionButton
                  label="Combine Armies"
                  disabled={false}
                  onClick={() => dispatch({ type: "COMBINE_ARMIES" })}
                />
              )}
              <ActionButton
                label="Deselect"
                disabled={false}
                onClick={() => dispatch({ type: "SELECT_HOLD", holdId: selectedHoldId })}
              />
            </>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 9,
                  color: "#c8941a",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  alignSelf: "center",
                  flex: 1,
                }}
              >
                Select destination on map
              </div>
              <ActionButton
                label="Cancel"
                disabled={false}
                onClick={() => dispatch({ type: "CANCEL_MOVE" })}
              />
            </>
          )}
        </div>
      )}

      {/* Select all */}
      {controllableArmies.length > 1 && !moveMode.active && (
        <div
          style={{
            borderBottom: "1px solid #1a1a1a",
            padding: "5px 14px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() =>
              allControllableSelected
                ? dispatch({ type: "SELECT_HOLD", holdId: selectedHoldId })
                : dispatch({ type: "SELECT_ALL_AT_HOLD", holdId: selectedHoldId })
            }
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 8,
              color: allControllableSelected ? "#c8941a" : "#555",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = allControllableSelected ? "#c8941a" : "#555")
            }
          >
            {allControllableSelected ? "✓ All selected" : "Select all armies here"}
          </button>
        </div>
      )}

      {/* Army lists */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {armiesHere.length === 0 ? (
          <div
            style={{
              padding: "24px 14px",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#2a2a2a",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              textAlign: "center",
            }}
          >
            No armies present
          </div>
        ) : (
          <>
            {northHere.length > 0 && (
              <Section label={FACTION_LABEL.north}>
                {northHere.map((army) => {
                  const hasOrder = state.north.orders.some((o) => o.armyId === army.id);
                  return (
                    <ArmyCard
                      key={army.id}
                      army={army}
                      isSelected={selectedArmyIds.includes(army.id)}
                      hasOrder={hasOrder}
                      isLocked={state.north.submitted}
                      onClick={(id, shift) =>
                        dispatch({ type: "SELECT_ARMY", armyId: id, shift })
                      }
                    />
                  );
                })}
              </Section>
            )}
            {westHere.length > 0 && (
              <Section label={FACTION_LABEL.westerlands}>
                {westHere.map((army) => {
                  const hasOrder = state.westerlands.orders.some((o) => o.armyId === army.id);
                  return (
                    <ArmyCard
                      key={army.id}
                      army={army}
                      isSelected={selectedArmyIds.includes(army.id)}
                      hasOrder={hasOrder}
                      isLocked={state.westerlands.submitted}
                      onClick={(id, shift) =>
                        dispatch({ type: "SELECT_ARMY", armyId: id, shift })
                      }
                    />
                  );
                })}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          padding: "6px 14px 4px",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 8,
          color: "#333",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          borderBottom: "1px solid #141414",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "6px 8px" }}>
        {children}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
  accent,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        padding: "4px 10px",
        cursor: disabled ? "default" : "pointer",
        border: accent ? "1px solid #3a2a00" : "1px solid #2a2a2a",
        background: accent ? "#1a1200" : "#0a0a0a",
        color: disabled ? "#333" : accent ? "#c8941a" : "#666",
        transition: "border-color 0.12s, color 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = accent ? "#c8941a" : "#555";
          e.currentTarget.style.color = accent ? "#f0b429" : "#aaa";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = accent ? "#3a2a00" : "#2a2a2a";
        e.currentTarget.style.color = disabled ? "#333" : accent ? "#c8941a" : "#666";
      }}
    >
      {label}
    </button>
  );
}
