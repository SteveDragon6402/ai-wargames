"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { GameState, GameAction, Army, Faction } from "../types";
import { HOLDS_MAP } from "../data/holds";
import { getCastleSeed } from "../data/castles";
import { regionTrait } from "../data/regions";
import {
  freeCapacity,
  garrisonHeadcount,
  isFriendlyTo,
  isGarrisonable,
  normalizeGarrison,
} from "../lib/hold-runtime";
import {
  garrisonArmyId,
  isGarrisonArmyId,
  minimumHoldingGarrison,
  minimumSiegeForce,
  resolveSelectableArmy,
} from "../lib/siege";
import {
  findNamedGarrisonNegotiator,
  negotiatorLabel,
} from "../lib/castellan";
import { forageAtHold, forageOnPath } from "../lib/forage";
import { openParleyAtHold } from "../lib/converse-client";
import ArmyCard from "./ArmyCard";
import SpeechComposer from "./SpeechComposer";
import ConversationDock from "./ConversationDock";
import TermsBlock from "./TermsBlock";
import PrisonerCard from "./PrisonerCard";
import SeatFatePanel from "./SeatFatePanel";
import TheaterOverview from "./TheaterOverview";
import { OrderButton, OrderGroup } from "./chrome/OrderButton";
import { prisonersAt, prisonersWith } from "../lib/prisoners";
import { canRaze } from "../lib/raze";
import { blockingChoicesFor, choiceAtHold } from "../lib/pending-choices";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  viewerFaction?: Faction;
}

const FACTION_LABEL: Record<Faction, string> = {
  north: "The North",
  westerlands: "The Westerlands",
};

export default function SidePanel({ state, dispatch, viewerFaction }: Props) {
  const [parleyError, setParleyError] = useState<string | null>(null);
  const { selectedHoldId, selectedArmyIds, moveMode, armies, activeFaction, adminMode } = state;
  const talkOpen = state.talkPickerOpen && state.phase === "planning";

  const hold = selectedHoldId ? HOLDS_MAP.get(selectedHoldId) : undefined;
  const trait = hold ? regionTrait(hold.region) : null;

  const armiesHere = selectedHoldId
    ? armies.filter((a) => a.holdId === selectedHoldId)
    : [];
  const wallArmy = selectedHoldId
    ? resolveSelectableArmy([], state.holdStates, garrisonArmyId(selectedHoldId))
    : undefined;
  const northHere = [
    ...(wallArmy?.faction === "north" ? [wallArmy] : []),
    ...armiesHere.filter((a) => a.faction === "north"),
  ];
  const westHere = [
    ...(wallArmy?.faction === "westerlands" ? [wallArmy] : []),
    ...armiesHere.filter((a) => a.faction === "westerlands"),
  ];

  const selectedArmies = selectedArmyIds
    .map((id) => resolveSelectableArmy(armies, state.holdStates, id))
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

  const myFaction = adminMode ? activeFaction : viewerFaction ?? activeFaction;
  const ownsSelection =
    adminMode ||
    (selectedArmies.length > 0 &&
      selectedArmies.every((a) => a.faction === myFaction));

  const canCombine =
    selectedArmies.length >= 2 &&
    ownsSelection &&
    selectedArmies.every((a) => a.holdId === selectedHoldId) &&
    selectedArmies.every((a) => !isGarrisonArmyId(a.id)) &&
    allSelectedSameFaction &&
    !isLocked;

  const singleSelected = selectedArmies.length === 1 ? selectedArmies[0] : null;
  const garrisonSelected =
    !!singleSelected && isGarrisonArmyId(singleSelected.id);
  const canSplit =
    !!singleSelected &&
    ownsSelection &&
    !garrisonSelected &&
    !isLocked &&
    (singleSelected.leaders.length >= 2 || singleSelected.units.length >= 2);

  const canChangeCommander =
    !!singleSelected && ownsSelection && !garrisonSelected && !isLocked;

  const canMove =
    selectedArmies.length > 0 &&
    ownsSelection &&
    !isLocked &&
    selectedArmies.every((a) => !isGarrisonArmyId(a.id));

  const singleArmyStanceOrder =
    singleSelected && selectedFaction
      ? (selectedFaction === "north"
          ? state.north.stanceOrders[singleSelected.id]
          : state.westerlands.stanceOrders[singleSelected.id]) ?? null
      : null;

  const canIssueStance = !!singleSelected && ownsSelection && !isLocked;

  const holdRuntime = selectedHoldId ? state.holdStates?.[selectedHoldId] : undefined;
  const castleSeed = selectedHoldId ? getCastleSeed(selectedHoldId) : undefined;
  const garrisonable = !!castleSeed && isGarrisonable(castleSeed);
  const garrisonMen = holdRuntime ? garrisonHeadcount(holdRuntime.garrison) : 0;
  const freeSlots = holdRuntime && selectedHoldId
    ? freeCapacity(selectedHoldId, holdRuntime)
    : 0;
  const friendlyHold = !!holdRuntime && isFriendlyTo(holdRuntime, myFaction);
  const nonHomeOccupier =
    !!holdRuntime &&
    holdRuntime.controller === myFaction &&
    holdRuntime.homeFaction !== myFaction;
  const underSiege = !!holdRuntime?.siege;
  const amBesieger =
    underSiege && holdRuntime!.siege!.besiegerFaction === myFaction;
  const amDefenderUnderSiege =
    underSiege &&
    holdRuntime!.siege!.besiegerFaction !== myFaction &&
    (holdRuntime!.controller === myFaction ||
      holdRuntime!.garrison.faction === myFaction ||
      ((holdRuntime!.controller === null ||
        holdRuntime!.controller === "hostile") &&
        holdRuntime!.homeFaction === myFaction));

  const factionFo = myFaction === "north" ? state.north : state.westerlands;
  const stormActive =
    !!singleSelected && factionFo.stormArmyIds.includes(singleSelected.id);
  const sallyActive = !!selectedHoldId && factionFo.sallyHoldIds.includes(selectedHoldId);

  const canGarrison =
    garrisonable &&
    !!singleSelected &&
    ownsSelection &&
    !garrisonSelected &&
    !isLocked &&
    !!selectedHoldId &&
    singleSelected.holdId === selectedHoldId &&
    freeSlots > 0 &&
    (friendlyHold || garrisonMen === 0);

  const openPledge = (state.capturePledges ?? []).find(
    (p) => p.holdId === selectedHoldId && p.faction === myFaction
  );
  const garrisonFloor =
    holdRuntime && holdRuntime.controller === holdRuntime.homeFaction
      ? castleSeed?.defaultGarrison ?? 0
      : openPledge?.minimumMen ??
        (selectedHoldId ? minimumHoldingGarrison(selectedHoldId, garrisonMen) : 0);

  const canUngarrison =
    garrisonable &&
    !isLocked &&
    !factionFo.submitted &&
    friendlyHold &&
    !nonHomeOccupier &&
    garrisonMen > garrisonFloor &&
    (!singleSelected || singleSelected.holdId === selectedHoldId);
  const canAbandon =
    garrisonable &&
    !!singleSelected &&
    ownsSelection &&
    !isLocked &&
    nonHomeOccupier &&
    garrisonMen > 0 &&
    !!selectedHoldId &&
    singleSelected.holdId === selectedHoldId;
  const canStorm =
    garrisonable &&
    !!singleSelected &&
    ownsSelection &&
    !isLocked &&
    amBesieger &&
    !!selectedHoldId &&
    singleSelected.holdId === selectedHoldId;
  const canSally =
    garrisonable &&
    !factionFo.submitted &&
    amDefenderUnderSiege &&
    garrisonMen > 0;

  const canParley =
    garrisonable &&
    !!holdRuntime &&
    state.phase === "planning" &&
    garrisonMen > 0 &&
    amBesieger;

  const ownMenHere = armiesHere
    .filter((a) => a.faction === myFaction)
    .reduce((s, a) => s + a.units.reduce((n, u) => n + u.count, 0), 0);
  const siegeRequirement = minimumSiegeForce(garrisonMen);
  const underStrengthSiege =
    garrisonable &&
    garrisonMen > 0 &&
    ownMenHere > 0 &&
    holdRuntime?.controller !== myFaction &&
    !armiesHere.some((a) => a.faction !== myFaction) &&
    ownMenHere < siegeRequirement
      ? { men: ownMenHere, required: siegeRequirement }
      : null;

  const wallsBrokenOpen =
    garrisonable &&
    !!holdRuntime &&
    garrisonMen === 0 &&
    !!holdRuntime.scar?.toLowerCase().includes("storm");

  const namedNegotiatorId =
    canParley && holdRuntime && selectedHoldId
      ? findNamedGarrisonNegotiator(
          selectedHoldId,
          state.holdStates,
          state.characters
        )
      : null;
  const parleyLabel = namedNegotiatorId
    ? negotiatorLabel(namedNegotiatorId, state.characters).name
    : "Castellan";

  const gSoft = holdRuntime ? normalizeGarrison(holdRuntime.garrison) : null;

  async function openCastleParley() {
    if (!selectedHoldId) return;
    setParleyError(null);
    const { error } = await openParleyAtHold(state, dispatch, selectedHoldId);
    if (error) setParleyError(error);
  }

  const fateHere = selectedHoldId
    ? choiceAtHold(state.pendingChoices, selectedHoldId)
    : null;
  const myFateHere = fateHere && fateHere.faction === myFaction ? fateHere : null;
  const otherFates = blockingChoicesFor(state.pendingChoices, myFaction).filter(
    (c) => c.holdId !== selectedHoldId
  );
  const holdPrisoners = selectedHoldId
    ? prisonersAt(state.prisoners, selectedHoldId)
    : [];
  const armyPrisoners = selectedArmies.flatMap((a) =>
    prisonersWith(state.prisoners, a.id)
  );

  const showOrders = selectedArmies.length > 0 || canSally;
  const lockedHint = "Orders are locked for this side.";
  const notYoursHint = "Select one of your hosts to issue this order.";

  return (
    <aside className="flex h-full w-[360px] min-w-0 shrink-0 flex-col self-stretch border-l border-border bg-card">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="font-display text-xl font-semibold leading-tight text-foreground">
            {hold?.name ?? "Theater"}
          </div>
          {hold ? (
            <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
              {hold.house} · {hold.region}
              {hold.lord ? ` · ${hold.lord}` : ""}
            </div>
          ) : (
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              Nothing selected
            </div>
          )}
        </div>
        {selectedHoldId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            title="Close this seat"
            onClick={() => dispatch({ type: "SELECT_HOLD", holdId: null })}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {state.phase === "planning" && (
        <div className="flex shrink-0 border-b border-border">
          <button
            type="button"
            onClick={() =>
              talkOpen ? dispatch({ type: "TOGGLE_TALK_PICKER" }) : undefined
            }
            className={cn(
              "flex-1 px-3 py-2 text-[12px] font-medium",
              !talkOpen
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {hold ? "This seat" : "Theater"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!talkOpen) dispatch({ type: "TOGGLE_TALK_PICKER" });
            }}
            className={cn(
              "flex-1 px-3 py-2 text-[12px] font-medium",
              talkOpen
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Talk
            {state.openConversationIds.length > 0
              ? ` (${state.openConversationIds.length})`
              : ""}
          </button>
        </div>
      )}

      {talkOpen ? (
        <ConversationDock state={state} dispatch={dispatch} />
      ) : !selectedHoldId || !hold ? (
        <TheaterOverview
          state={state}
          dispatch={dispatch}
          viewerFaction={viewerFaction}
        />
      ) : (
        <>
          <ScrollArea className="min-h-0 flex-1">
            {otherFates.length > 0 && (
              <div className="space-y-2 border-b border-border px-4 py-3">
                {otherFates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => dispatch({ type: "SELECT_HOLD", holdId: c.holdId })}
                    className="block w-full rounded-sm border border-primary/40 bg-primary/10 px-3 py-2 text-left text-[12px] text-primary"
                  >
                    Fate unpaid — {c.headline}
                  </button>
                ))}
              </div>
            )}

            {showOrders && (
              <section className="space-y-3 border-b border-border px-4 py-3">
                <div className="text-[11px] font-medium text-muted-foreground">
                  Orders
                </div>
                {moveMode.active ? (
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-[13px] text-primary">
                      Click a highlighted hold on the map.
                    </p>
                    <OrderButton
                      label="Cancel"
                      hint="Stop choosing a destination"
                      onClick={() => dispatch({ type: "CANCEL_MOVE" })}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedArmies.length > 0 && (
                      <>
                        <OrderGroup title="March">
                          <OrderButton
                            label="Move"
                            hint="March the selected host to an adjacent hold. Then click the destination on the map."
                            disabledHint={
                              isLocked
                                ? lockedHint
                                : garrisonSelected
                                  ? "Men on the walls cannot march. Ungarrison them first."
                                  : notYoursHint
                            }
                            disabled={!canMove}
                            accent
                            onClick={() => dispatch({ type: "BEGIN_MOVE" })}
                          />
                        </OrderGroup>
                        <OrderGroup title="Camp">
                          {canIssueStance && (
                            <OrderButton
                              label="Rest"
                              hint="Spend the turn recovering condition. The host will not march."
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
                            <OrderButton
                              label={
                                singleSelected &&
                                holdRuntime?.siege?.besiegerFaction ===
                                  singleSelected.faction
                                  ? "Dig in"
                                  : "Fortify"
                              }
                              hint={
                                singleSelected &&
                                holdRuntime?.siege?.besiegerFaction ===
                                  singleSelected.faction
                                  ? "Defend the siege camp, not the keep. If a host friendly to the garrison attacks the camp, the garrison will sally."
                                  : "Dig in at this seat. The host will not march."
                              }
                              active={singleArmyStanceOrder === "fortify"}
                              onClick={() =>
                                dispatch({
                                  type: "SET_STANCE_ORDER",
                                  armyId: singleSelected!.id,
                                  order:
                                    singleArmyStanceOrder === "fortify" ? null : "fortify",
                                })
                              }
                            />
                          )}
                          {canIssueStance && (
                            <OrderButton
                              label="Speech"
                              hint="Address the men to raise morale. Once per host per turn."
                              disabledHint="This host already heard a speech this turn."
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
                        </OrderGroup>
                        <OrderGroup title="Walls">
                          {canGarrison && (
                            <OrderButton
                              label="Garrison"
                              hint="Post men from this host onto the walls."
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
                            <OrderButton
                              label="Abandon"
                              hint="Leave this conquered seat empty and take the garrison with you."
                              onClick={() =>
                                dispatch({
                                  type: "OPEN_GARRISON_PANEL",
                                  holdId: selectedHoldId,
                                  mode: "abandon",
                                  armyId: garrisonSelected
                                    ? null
                                    : singleSelected?.id ?? null,
                                })
                              }
                            />
                          )}
                          {canStorm && (
                            <OrderButton
                              label="Storm"
                              hint="Assault the walls this turn instead of starving them out."
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
                          {selectedArmies.some(
                            (a) =>
                              (adminMode || a.faction === myFaction) &&
                              canRaze(a, selectedHoldId, holdRuntime).ok
                          ) && (
                            <OrderButton
                              label={
                                (state[myFaction].razeOrders ?? []).some(
                                  (o) => o.holdId === selectedHoldId
                                )
                                  ? "Cancel raze"
                                  : "Raze"
                              }
                              hint="Burn this seat. It will not feed or shelter anyone after."
                              onClick={() => {
                                const army = selectedArmies.find((a) =>
                                  canRaze(a, selectedHoldId, holdRuntime).ok
                                );
                                if (!army) return;
                                const active = (state[army.faction].razeOrders ?? []).some(
                                  (o) => o.armyId === army.id
                                );
                                dispatch({
                                  type: "SET_RAZE_ORDER",
                                  armyId: army.id,
                                  holdId: selectedHoldId,
                                  active: !active,
                                });
                              }}
                            />
                          )}
                        </OrderGroup>
                        <OrderGroup title="Host">
                          {canCombine && (
                            <OrderButton
                              label="Combine"
                              hint="Merge the selected hosts at this seat into one."
                              onClick={() => dispatch({ type: "COMBINE_ARMIES" })}
                            />
                          )}
                          {canSplit && (
                            <OrderButton
                              label="Split"
                              hint="Divide this host into two, and assign men and captains."
                              onClick={() =>
                                dispatch({
                                  type: "OPEN_SPLIT",
                                  armyId: singleSelected!.id,
                                })
                              }
                            />
                          )}
                          {canChangeCommander && (
                            <OrderButton
                              label="Commander"
                              hint="Change who leads this host."
                              onClick={() =>
                                dispatch({
                                  type: "OPEN_COMMANDER_CHANGE",
                                  armyId: singleSelected!.id,
                                })
                              }
                            />
                          )}
                          <OrderButton
                            label="Deselect"
                            hint="Clear the host selection. The seat stays open."
                            onClick={() =>
                              dispatch({ type: "SELECT_HOLD", holdId: selectedHoldId })
                            }
                          />
                        </OrderGroup>
                      </>
                    )}
                    {canSally && (
                      <OrderGroup title="Garrison">
                        <OrderButton
                          label="Sally out"
                          hint="The garrison rides out against the besiegers this turn."
                          active={sallyActive}
                          accent
                          onClick={() =>
                            dispatch({
                              type: "SET_SALLY_ORDER",
                              holdId: selectedHoldId,
                              active: !sallyActive,
                            })
                          }
                        />
                      </OrderGroup>
                    )}
                  </div>
                )}
              </section>
            )}

            {garrisonable && holdRuntime && castleSeed && (
              <PanelSection
                title="Seat"
                hint={
                  holdRuntime.siege
                    ? `Garrison ${garrisonMen.toLocaleString()} · siege`
                    : `Garrison ${garrisonMen.toLocaleString()}`
                }
                defaultOpen={
                  !!holdRuntime.siege ||
                  !!myFateHere ||
                  holdPrisoners.length > 0 ||
                  armyPrisoners.length > 0 ||
                  !!openPledge
                }
                accent={!!myFateHere || !!holdRuntime.siege}
              >
                <p className="text-[12px] text-muted-foreground">
                  {castleSeed.siteKind} · held by{" "}
                  {holdRuntime.controller ?? "no one"} · home{" "}
                  {holdRuntime.homeFaction}
                </p>
                <p className="mt-1 font-mono text-[13px] text-foreground">
                  Garrison {garrisonMen.toLocaleString()} /{" "}
                  {castleSeed.capacity.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Usual strength {castleSeed.defaultGarrison.toLocaleString()} ·{" "}
                  {freeSlots.toLocaleString()} free
                </p>
                {holdRuntime.garrison.leaders.length > 0 && (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Command:{" "}
                    {holdRuntime.garrison.leaders.map((l) => l.name).join(", ")}
                  </p>
                )}
                <p className="mt-1 text-[13px] italic leading-relaxed text-muted-foreground">
                  {holdRuntime.supplies}
                </p>
                {gSoft && garrisonMen > 0 && (
                  <div className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
                    <div>Morale: {gSoft.morale}</div>
                    <div>Condition: {gSoft.tiredness}</div>
                    <div>Stance: {gSoft.stance}</div>
                  </div>
                )}
                {holdRuntime.foodDaysRemaining != null && (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Food ~{holdRuntime.foodDaysRemaining} days
                  </p>
                )}
                {holdRuntime.siege && (
                  <p className="mt-2 text-[12px] font-medium text-bad">
                    Under siege · turn {holdRuntime.siege.turns} ·{" "}
                    {holdRuntime.siege.besiegerFaction === "north"
                      ? "the North"
                      : "the Westerlands"}
                  </p>
                )}
                {holdRuntime.postSiegeTurnsLeft > 0 && !holdRuntime.siege && (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Post-siege recovery ({holdRuntime.postSiegeTurnsLeft})
                  </p>
                )}
                {wallsBrokenOpen && (
                  <p className="mt-2 text-[13px] text-primary">
                    Walls broken — gates forced
                  </p>
                )}
                {openPledge && (
                  <div className="mt-2 rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-2 text-[12px] leading-relaxed text-primary">
                    Seat taken — walls empty.
                    <div className="mt-1 text-primary/80">
                      Posting at least {openPledge.minimumMen.toLocaleString()} men
                      is optional. The host may still rest, fortify, speak, or
                      march.
                    </div>
                  </div>
                )}
                {underStrengthSiege && (
                  <div className="mt-2 rounded-sm border border-bad/40 bg-bad/10 px-2.5 py-2 text-[12px] leading-relaxed text-bad">
                    Too few to besiege.
                    <div className="mt-1 opacity-80">
                      {underStrengthSiege.men.toLocaleString()} men cannot ring a
                      garrison of {garrisonMen.toLocaleString()}.{" "}
                      {underStrengthSiege.required.toLocaleString()} are needed.
                    </div>
                  </div>
                )}
                {holdRuntime.siege && (
                  <div className="mt-2">
                    <TermsBlock
                      state={state}
                      dispatch={dispatch}
                      holdId={selectedHoldId}
                      faction={myFaction}
                    />
                  </div>
                )}
                {myFateHere && (
                  <div className="mt-2">
                    <SeatFatePanel
                      state={state}
                      dispatch={dispatch}
                      viewerFaction={myFaction}
                      embedded
                      holdId={selectedHoldId}
                    />
                  </div>
                )}
                {holdPrisoners.map((g) => (
                  <PrisonerCard
                    key={g.id}
                    group={g}
                    state={state}
                    dispatch={dispatch}
                  />
                ))}
                {armyPrisoners.map((g) => (
                  <PrisonerCard
                    key={g.id}
                    group={g}
                    state={state}
                    dispatch={dispatch}
                  />
                ))}
                {(canUngarrison || canParley) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {canUngarrison && (
                      <OrderButton
                        label="Ungarrison"
                        hint="Draw men off the walls into a field host."
                        onClick={() =>
                          dispatch({
                            type: "OPEN_GARRISON_PANEL",
                            holdId: selectedHoldId,
                            mode: "withdraw",
                            armyId: garrisonSelected
                              ? null
                              : singleSelected?.id ?? null,
                          })
                        }
                      />
                    )}
                    {canParley && (
                      <OrderButton
                        label={`Talk · ${parleyLabel}`}
                        hint={`Open a parley with ${parleyLabel}.`}
                        accent
                        onClick={() => void openCastleParley()}
                      />
                    )}
                  </div>
                )}
                {parleyError && (
                  <p className="mt-2 text-[12px] text-bad">{parleyError}</p>
                )}
              </PanelSection>
            )}

            {controllableArmies.length > 1 && !moveMode.active && (
              <div className="border-b border-border px-4 py-2">
                <button
                  type="button"
                  onClick={() =>
                    allControllableSelected
                      ? dispatch({ type: "SELECT_HOLD", holdId: selectedHoldId })
                      : dispatch({
                          type: "SELECT_ALL_AT_HOLD",
                          holdId: selectedHoldId,
                        })
                  }
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                >
                  {allControllableSelected
                    ? "Clear host selection"
                    : "Select all of your hosts here"}
                </button>
              </div>
            )}

            <PanelSection
              title="Hosts"
              hint={
                northHere.length + westHere.length > 0
                  ? `${northHere.length + westHere.length} here`
                  : "none"
              }
              defaultOpen
            >
              {northHere.length === 0 && westHere.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-muted-foreground">
                  No armies present
                </p>
              ) : (
                <div className="space-y-3">
                  {northHere.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-north">{FACTION_LABEL.north}</div>
                      {northHere.map((army) => (
                        <ArmyCard
                          key={army.id}
                          army={army}
                          isSelected={selectedArmyIds.includes(army.id)}
                          hasOrder={state.north.orders.some((o) => o.armyId === army.id)}
                          stanceOrder={state.north.stanceOrders[army.id] ?? null}
                          hadSpeech={state.speechesThisTurn.includes(army.id)}
                          isLocked={state.north.submitted}
                          onTheWalls={isGarrisonArmyId(army.id)}
                          onClick={(id, shift) =>
                            dispatch({ type: "SELECT_ARMY", armyId: id, shift })
                          }
                        />
                      ))}
                    </div>
                  )}
                  {westHere.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-west">
                        {FACTION_LABEL.westerlands}
                      </div>
                      {westHere.map((army) => (
                        <ArmyCard
                          key={army.id}
                          army={army}
                          isSelected={selectedArmyIds.includes(army.id)}
                          hasOrder={state.westerlands.orders.some(
                            (o) => o.armyId === army.id
                          )}
                          stanceOrder={state.westerlands.stanceOrders[army.id] ?? null}
                          hadSpeech={state.speechesThisTurn.includes(army.id)}
                          isLocked={state.westerlands.submitted}
                          onTheWalls={isGarrisonArmyId(army.id)}
                          onClick={(id, shift) =>
                            dispatch({ type: "SELECT_ARMY", armyId: id, shift })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </PanelSection>

            {trait && (
              <PanelSection title="Country" hint={trait.name} defaultOpen={false}>
                <div className="text-[11px] text-muted-foreground">Roads</div>
                <div className="mt-1 space-y-1 text-[12px] leading-relaxed text-muted-foreground">
                  {hold.links.map((id) => {
                    const name = HOLDS_MAP.get(id)?.name ?? id;
                    return (
                      <div key={id}>
                        {name} — {forageOnPath(state.forage, hold.id, id)}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">{trait.name}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {trait.blurb}
                </p>
                <div className="mt-3 text-[11px] text-muted-foreground">Forage</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {forageAtHold(state.forage, hold.id)}
                </p>
              </PanelSection>
            )}
          </ScrollArea>

          {singleSelected &&
            state.speechArmyId === singleSelected.id &&
            (adminMode || singleSelected.faction === activeFaction) && (
              <div className="max-h-[36%] min-h-0 shrink-0 overflow-y-auto border-t border-border">
                <SpeechComposer
                  army={singleSelected}
                  state={state}
                  dispatch={dispatch}
                />
              </div>
            )}
        </>
      )}
    </aside>
  );
}

function PanelSection({
  title,
  hint,
  defaultOpen = false,
  accent,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group border-b border-border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-[12px] font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className={cn(accent && "text-primary")}>{title}</span>
        {hint && (
          <span className="max-w-[180px] truncate text-[11px] font-normal text-muted-foreground/70 group-open:hidden">
            {hint}
          </span>
        )}
      </summary>
      <div className="px-4 pb-3">{children}</div>
    </details>
  );
}
