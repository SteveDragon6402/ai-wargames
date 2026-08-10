"use client";

import { useState } from "react";
import type { GameState, GameAction, Army, Faction } from "../types";
import { HOLDS_MAP } from "../data/holds";
import { getCastleSeed } from "../data/castles";
import {
  freeCapacity,
  garrisonHeadcount,
  isFriendlyTo,
  isGarrisonable,
  normalizeGarrison,
} from "../lib/hold-runtime";
import {
  ensureGarrisonNegotiator,
  findNamedGarrisonNegotiator,
  negotiatorLabel,
} from "../lib/castellan";
import { startDirectNpcTalk } from "../lib/converse-client";
import ArmyCard from "./ArmyCard";
import SpeechComposer from "./SpeechComposer";
import ConversationDock from "./ConversationDock";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const FACTION_LABEL: Record<Faction, string> = {
  north: "The North",
  westerlands: "The Westerlands",
};

export default function SidePanel({ state, dispatch }: Props) {
  const [parleyError, setParleyError] = useState<string | null>(null);
  const { selectedHoldId, selectedArmyIds, moveMode, armies, activeFaction, adminMode } = state;

  // Talk takes the right rail (map stays primary — no left dock)
  if (state.talkPickerOpen && state.phase === "planning") {
    return <ConversationDock state={state} dispatch={dispatch} />;
  }

  // No sidebar until a hold is selected
  if (!selectedHoldId) {
    return null;
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

  // Can split: exactly 1 selected, not locked, has at least 2 leaders or 2 unit groups
  const singleSelected = selectedArmies.length === 1 ? selectedArmies[0] : null;
  const canSplit =
    !!singleSelected &&
    !isLocked &&
    (singleSelected.leaders.length >= 2 || singleSelected.units.length >= 2);

  // Can change commander: any single controllable army (including appointing / clearing)
  const canChangeCommander = !!singleSelected && !isLocked;

  // Can move: 1+ selected, not locked, not in move mode
  const canMove = selectedArmies.length > 0 && !isLocked;

  // Stance orders for selected single army
  const singleArmyStanceOrder =
    singleSelected && selectedFaction
      ? (selectedFaction === "north"
          ? state.north.stanceOrders[singleSelected.id]
          : state.westerlands.stanceOrders[singleSelected.id]) ?? null
      : null;

  const canIssueStance = !!singleSelected && !isLocked;

  const holdRuntime = state.holdStates?.[selectedHoldId];
  const castleSeed = getCastleSeed(selectedHoldId);
  const garrisonable = isGarrisonable(castleSeed);
  const garrisonMen = holdRuntime
    ? garrisonHeadcount(holdRuntime.garrison)
    : 0;
  const freeSlots = holdRuntime
    ? freeCapacity(selectedHoldId, holdRuntime)
    : 0;

  const myFaction = adminMode ? activeFaction : activeFaction;
  const friendlyHold =
    !!holdRuntime && isFriendlyTo(holdRuntime, myFaction);
  const nonHomeOccupier =
    !!holdRuntime &&
    holdRuntime.controller === myFaction &&
    holdRuntime.homeFaction !== myFaction;
  const underSiege = !!holdRuntime?.siege;
  const amBesieger =
    underSiege && holdRuntime!.siege!.besiegerFaction === myFaction;
  const amDefenderUnderSiege =
    underSiege &&
    friendlyHold &&
    holdRuntime!.siege!.besiegerFaction !== myFaction;

  const factionFo =
    myFaction === "north" ? state.north : state.westerlands;
  const stormActive =
    !!singleSelected && factionFo.stormArmyIds.includes(singleSelected.id);
  const sallyActive = factionFo.sallyHoldIds.includes(selectedHoldId);

  const canGarrison =
    garrisonable &&
    !!singleSelected &&
    !isLocked &&
    singleSelected.holdId === selectedHoldId &&
    freeSlots > 0 &&
    (friendlyHold ||
      holdRuntime?.controller === null ||
      garrisonMen === 0);
  const canUngarrison =
    garrisonable &&
    !isLocked &&
    !factionFo.submitted &&
    friendlyHold &&
    !nonHomeOccupier &&
    garrisonMen > castleSeed.defaultGarrison &&
    (!singleSelected || singleSelected.holdId === selectedHoldId);
  const canAbandon =
    garrisonable &&
    !!singleSelected &&
    !isLocked &&
    nonHomeOccupier &&
    garrisonMen > 0;
  const canStorm =
    garrisonable &&
    !!singleSelected &&
    !isLocked &&
    amBesieger &&
    singleSelected.holdId === selectedHoldId;
  const canSally =
    garrisonable &&
    !factionFo.submitted &&
    amDefenderUnderSiege &&
    garrisonMen > 0;

  const myArmiesAtHold = armiesHere.some((a) => a.faction === myFaction);
  const canParley =
    garrisonable &&
    !!holdRuntime &&
    state.phase === "planning" &&
    garrisonMen > 0 &&
    (friendlyHold || amBesieger || myArmiesAtHold);

  const wallsBrokenOpen =
    garrisonable &&
    !!holdRuntime &&
    holdRuntime.controller === null &&
    garrisonMen === 0 &&
    (holdRuntime.scar?.toLowerCase().includes("storm") ||
      holdRuntime.supplies.toLowerCase().includes("open") ||
      holdRuntime.postSiegeTurnsLeft > 0);

  const namedNegotiatorId =
    canParley && holdRuntime
      ? findNamedGarrisonNegotiator(
          selectedHoldId,
          state.holdStates,
          state.characters
        )
      : null;
  const parleyLabel = namedNegotiatorId
    ? negotiatorLabel(namedNegotiatorId, state.characters).name
    : "Castellan";

  const gSoft = holdRuntime
    ? normalizeGarrison(holdRuntime.garrison)
    : null;

  async function openCastleParley() {
    if (!selectedHoldId) return;
    setParleyError(null);
    const ensured = ensureGarrisonNegotiator(
      selectedHoldId,
      state.holdStates ?? {},
      state.characters
    );
    if (!ensured) {
      setParleyError("No negotiator available at this seat.");
      return;
    }
    dispatch({
      type: "APPLY_NEGOTIATOR_ENSURE",
      characters: ensured.characters,
      holdStates: ensured.holdStates,
    });
    const err = await startDirectNpcTalk(
      state,
      dispatch,
      ensured.negotiatorId,
      {
        characters: ensured.characters,
        holdStates: ensured.holdStates,
      }
    );
    if (err) setParleyError(err);
  }

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

      {/* Castle / garrison overview */}
      {garrisonable && holdRuntime && (
        <div
          style={{
            borderBottom: "1px solid #1e1e1e",
            padding: "10px 14px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 8,
              color: "#555",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 6,
            }}
          >
            {castleSeed.siteKind} · controller{" "}
            {holdRuntime.controller ?? "none"} · home{" "}
            {holdRuntime.homeFaction}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              color: "#ccc",
              marginBottom: 4,
            }}
          >
            Garrison {garrisonMen.toLocaleString()} /{" "}
            {castleSeed.capacity.toLocaleString()}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#666",
              marginBottom: 6,
            }}
          >
            default {castleSeed.defaultGarrison.toLocaleString()} · free{" "}
            {freeSlots.toLocaleString()}
          </div>
          {holdRuntime.garrison.leaders.length > 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 9,
                color: "#888",
                marginBottom: 4,
              }}
            >
              Cmd:{" "}
              {holdRuntime.garrison.leaders.map((l) => l.name).join(", ")}
            </div>
          )}
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#777",
              fontStyle: "italic",
              marginBottom: 4,
            }}
          >
            {holdRuntime.supplies}
          </div>
          {gSoft && garrisonMen > 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 9,
                color: "#666",
                marginBottom: 6,
                lineHeight: 1.45,
              }}
            >
              <div>Morale: {gSoft.morale}</div>
              <div>Condition: {gSoft.tiredness}</div>
              <div>Stance: {gSoft.stance}</div>
            </div>
          )}
          {holdRuntime.foodDaysRemaining != null && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 9,
                color: "#666",
              }}
            >
              Food ~{holdRuntime.foodDaysRemaining} days
            </div>
          )}
          {holdRuntime.siege && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 9,
                color: "#c05050",
                marginTop: 6,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Under siege · turn {holdRuntime.siege.turns} ·{" "}
              {holdRuntime.siege.besiegerFaction}
            </div>
          )}
          {holdRuntime.postSiegeTurnsLeft > 0 && !holdRuntime.siege && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 8,
                color: "#555",
                marginTop: 4,
              }}
            >
              Post-siege recovery ({holdRuntime.postSiegeTurnsLeft})
            </div>
          )}
          {wallsBrokenOpen && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 9,
                color: "#c8941a",
                marginTop: 6,
              }}
            >
              Walls broken — garrison to claim
            </div>
          )}
          {(canUngarrison || canParley) && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {canUngarrison && (
                <ActionButton
                  label="Ungarrison"
                  disabled={false}
                  onClick={() =>
                    dispatch({
                      type: "OPEN_GARRISON_PANEL",
                      holdId: selectedHoldId,
                      mode: "withdraw",
                      armyId: singleSelected?.id ?? null,
                    })
                  }
                />
              )}
              {canParley && (
                <ActionButton
                  label={`Talk · ${parleyLabel}`}
                  disabled={false}
                  onClick={() => void openCastleParley()}
                  accent
                />
              )}
            </div>
          )}
          {parleyError && (
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 9,
                color: "#c05050",
                marginTop: 6,
              }}
            >
              {parleyError}
            </div>
          )}
        </div>
      )}

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
                  label="Combine"
                  disabled={false}
                  onClick={() => dispatch({ type: "COMBINE_ARMIES" })}
                />
              )}
              {canSplit && (
                <ActionButton
                  label="Split"
                  disabled={false}
                  onClick={() => dispatch({ type: "OPEN_SPLIT", armyId: singleSelected!.id })}
                />
              )}
              {canChangeCommander && (
                <ActionButton
                  label="Commander"
                  disabled={false}
                  onClick={() =>
                    dispatch({ type: "OPEN_COMMANDER_CHANGE", armyId: singleSelected!.id })
                  }
                />
              )}
              {canIssueStance && (
                <ActionButton
                  label="Rest"
                  disabled={false}
                  active={singleArmyStanceOrder === "rest"}
                  onClick={() =>
                    dispatch({
                      type: "SET_STANCE_ORDER",
                      armyId: singleSelected!.id,
                      order: singleArmyStanceOrder === "rest" ? null : "rest",
                    })
                  }
                />
              )}
              {canIssueStance && (
                <ActionButton
                  label="Fortify"
                  disabled={false}
                  active={singleArmyStanceOrder === "fortify"}
                  onClick={() =>
                    dispatch({
                      type: "SET_STANCE_ORDER",
                      armyId: singleSelected!.id,
                      order: singleArmyStanceOrder === "fortify" ? null : "fortify",
                    })
                  }
                />
              )}
              {canIssueStance && (
                <ActionButton
                  label="Speech"
                  disabled={state.speechesThisTurn.includes(singleSelected!.id)}
                  active={state.speechArmyId === singleSelected!.id}
                  onClick={() =>
                    state.speechArmyId === singleSelected!.id
                      ? dispatch({ type: "CLOSE_SPEECH" })
                      : dispatch({
                          type: "OPEN_SPEECH",
                          armyId: singleSelected!.id,
                        })
                  }
                />
              )}
              {canGarrison && (
                <ActionButton
                  label="Garrison"
                  disabled={false}
                  onClick={() =>
                    dispatch({
                      type: "OPEN_GARRISON_PANEL",
                      holdId: selectedHoldId,
                      mode: "deposit",
                      armyId: singleSelected!.id,
                    })
                  }
                />
              )}
              {canAbandon && (
                <ActionButton
                  label="Abandon"
                  disabled={false}
                  onClick={() =>
                    dispatch({
                      type: "OPEN_GARRISON_PANEL",
                      holdId: selectedHoldId,
                      mode: "abandon",
                      armyId: singleSelected!.id,
                    })
                  }
                />
              )}
              {canStorm && (
                <ActionButton
                  label="Storm"
                  disabled={false}
                  active={stormActive}
                  onClick={() =>
                    dispatch({
                      type: "SET_STORM_ORDER",
                      armyId: singleSelected!.id,
                      active: !stormActive,
                    })
                  }
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

      {canSally && (
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
          <ActionButton
            label="Sally Out"
            disabled={false}
            active={sallyActive}
            onClick={() =>
              dispatch({
                type: "SET_SALLY_ORDER",
                holdId: selectedHoldId,
                active: !sallyActive,
              })
            }
            accent
          />
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
                  const stanceOrder = state.north.stanceOrders[army.id] ?? null;
                  return (
                    <ArmyCard
                      key={army.id}
                      army={army}
                      isSelected={selectedArmyIds.includes(army.id)}
                      hasOrder={hasOrder}
                      stanceOrder={stanceOrder}
                      hadSpeech={state.speechesThisTurn.includes(army.id)}
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
                  const stanceOrder = state.westerlands.stanceOrders[army.id] ?? null;
                  return (
                    <ArmyCard
                      key={army.id}
                      army={army}
                      isSelected={selectedArmyIds.includes(army.id)}
                      hasOrder={hasOrder}
                      stanceOrder={stanceOrder}
                      hadSpeech={state.speechesThisTurn.includes(army.id)}
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

      {singleSelected &&
        state.speechArmyId === singleSelected.id &&
        (adminMode || singleSelected.faction === activeFaction) && (
          <SpeechComposer army={singleSelected} state={state} dispatch={dispatch} />
        )}
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
  active,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  accent?: boolean;
  active?: boolean;
}) {
  const isActive = active ?? false;
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
        border: accent
          ? "1px solid #3a2a00"
          : isActive
            ? "1px solid #c8941a"
            : "1px solid #2a2a2a",
        background: accent ? "#1a1200" : isActive ? "#2a1800" : "#0a0a0a",
        color: disabled
          ? "#333"
          : accent
            ? "#c8941a"
            : isActive
              ? "#f0b429"
              : "#666",
        transition: "border-color 0.12s, color 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = accent || isActive ? "#c8941a" : "#555";
          e.currentTarget.style.color = accent || isActive ? "#f0b429" : "#aaa";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = accent
          ? "#3a2a00"
          : isActive
            ? "#c8941a"
            : "#2a2a2a";
        e.currentTarget.style.color = disabled
          ? "#333"
          : accent
            ? "#c8941a"
            : isActive
              ? "#f0b429"
              : "#666";
      }}
    >
      {label}
    </button>
  );
}
