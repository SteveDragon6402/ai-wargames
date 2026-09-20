"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, PanelRightClose, X } from "lucide-react";
import type { GameState, GameAction, Army, Faction } from "../types";
import { HOLDS_MAP } from "../data/holds";
import { getCastleSeed } from "../data/castles";
import { regionTrait } from "../data/regions";
import {
  freeCapacity,
  garrisonHeadcount,
  isFriendlyTo,
  isGarrisonable,
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
import { forageAtHold } from "../lib/forage";
import { openParleyAtHold } from "../lib/converse-client";
import ArmyCard from "./ArmyCard";
import SpeechComposer from "./SpeechComposer";
import ConversationDock from "./ConversationDock";
import TermsBlock from "./TermsBlock";
import PrisonerCard from "./PrisonerCard";
import SeatFatePanel from "./SeatFatePanel";
import TheaterOverview from "./TheaterOverview";
import { OrderButton } from "./chrome/OrderButton";
import { prisonersAt, prisonersWith } from "../lib/prisoners";
import { canRaze } from "../lib/raze";
import { blockingChoicesFor, choiceAtHold } from "../lib/pending-choices";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [railOpen, setRailOpen] = useState(true);
  const prevHoldId = useRef<string | null>(null);
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
  const who =
    selectedArmies.length === 1
      ? selectedArmies[0].name
      : selectedArmies.length > 1
        ? `${selectedArmies.length} hosts`
        : "This garrison";
  const marchDestIds = [
    ...new Set(
      selectedArmies
        .map((a) => {
          const fo = a.faction === "north" ? state.north : state.westerlands;
          return fo.orders.find((o) => o.armyId === a.id)?.toHoldId;
        })
        .filter((id): id is string => !!id)
    ),
  ];
  const razeActive = selectedArmies.some((a) =>
    (state[a.faction].razeOrders ?? []).some(
      (o) => o.armyId === a.id && o.holdId === selectedHoldId
    )
  );
  const canRazeStay = selectedArmies.some((a) => {
    if (!selectedHoldId) return false;
    return (
      (adminMode || a.faction === myFaction) &&
      canRaze(a, selectedHoldId, holdRuntime).ok
    );
  });
  const jobLine = (() => {
    if (isLocked) {
      return "This side has committed. The field is judged when both sides have.";
    }
    if (garrisonSelected) {
      return `${who} are on the walls. They cannot march until you take them off.`;
    }
    if (stormActive) {
      return `This turn ${who} will storm the walls.`;
    }
    if (sallyActive) {
      return "This turn the garrison will ride out against the besiegers.";
    }
    if (razeActive) {
      return `This turn ${who} will burn this seat.`;
    }
    if (singleArmyStanceOrder === "rest") {
      return `This turn ${who} will rest here, and will not march.`;
    }
    if (singleArmyStanceOrder === "fortify") {
      return `This turn ${who} will dig in here, and will not march.`;
    }
    if (marchDestIds.length === 1) {
      const dest = HOLDS_MAP.get(marchDestIds[0])?.name ?? marchDestIds[0];
      return `This turn ${who} will march to ${dest}. Click another neighbour to change.`;
    }
    if (marchDestIds.length > 1) {
      return "This turn these hosts will march to different seats.";
    }
    if (canMove) {
      return `${who} ${selectedArmies.length === 1 ? "has" : "have"} no job yet. March is ready — click a glowing neighbour, or Rest / Dig in to stay.`;
    }
    if (canSally) {
      return "The garrison can ride out this turn, or wait behind the walls.";
    }
    return "Click one of your hosts — the coloured number on the map, or a name in this list.";
  })();

  const marchDestName =
    marchDestIds.length === 1
      ? (HOLDS_MAP.get(marchDestIds[0])?.name ?? marchDestIds[0])
      : null;
  const marching =
    moveMode.active || marchDestIds.length > 0;

  function startMarch() {
    if (
      singleSelected &&
      (singleArmyStanceOrder === "rest" || singleArmyStanceOrder === "fortify")
    ) {
      dispatch({
        type: "SET_STANCE_ORDER",
        armyId: singleSelected.id,
        order: null,
      });
      return;
    }
    if (stormActive && singleSelected) {
      dispatch({
        type: "SET_STORM_ORDER",
        armyId: singleSelected.id,
        active: false,
      });
      return;
    }
    if (razeActive && singleSelected && selectedHoldId) {
      dispatch({
        type: "SET_RAZE_ORDER",
        armyId: singleSelected.id,
        holdId: selectedHoldId,
        active: false,
      });
      return;
    }
    if (!moveMode.active) {
      dispatch({ type: "BEGIN_MOVE" });
    }
  }

  function cancelMarch() {
    for (const army of selectedArmies) {
      dispatch({ type: "SET_STANCE_ORDER", armyId: army.id, order: null });
    }
  }

  useEffect(() => {
    try {
      if (localStorage.getItem("wargame-rail") === "0") setRailOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  function persistRail(open: boolean) {
    try {
      localStorage.setItem("wargame-rail", open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function toggleRail() {
    setRailOpen((open) => {
      const next = !open;
      persistRail(next);
      return next;
    });
  }

  const armyKey = selectedArmyIds.join(",");
  useEffect(() => {
    if (selectedArmyIds.length === 0) return;
    setRailOpen(true);
    persistRail(true);
  }, [armyKey, selectedArmyIds.length]);

  useEffect(() => {
    if (selectedHoldId && selectedHoldId !== prevHoldId.current) {
      setRailOpen(true);
      persistRail(true);
    }
    prevHoldId.current = selectedHoldId;
  }, [selectedHoldId]);

  if (!railOpen) {
    return (
      <aside className="flex h-full w-10 shrink-0 flex-col border-l border-border bg-card">
        <button
          type="button"
          onClick={toggleRail}
          title="Open inspector"
          className="flex h-full flex-col items-center gap-3 px-1 py-3 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className="size-4" />
          {selectedArmyIds.length > 0 && (
            <span className="font-mono text-[10px] text-primary">
              {selectedArmyIds.length}
            </span>
          )}
          <span className="text-[11px] [writing-mode:vertical-rl]">Inspect</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[min(360px,100%)] min-w-0 max-w-full shrink-0 flex-col self-stretch overflow-hidden border-l border-border bg-card">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 overflow-hidden">
          <div className="truncate font-display text-xl font-semibold leading-tight text-foreground">
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
        <div className="flex shrink-0 items-center gap-0.5">
          {selectedHoldId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              title="Close this seat"
              onClick={() => dispatch({ type: "SELECT_HOLD", holdId: null })}
            >
              <X className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            title="Collapse inspector"
            onClick={toggleRail}
          >
            <PanelRightClose className="size-4" />
          </Button>
        </div>
      </div>

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
          <ScrollArea className="min-h-0 flex-1 overflow-x-hidden">
            {otherFates.length > 0 && (
              <div className="space-y-2 border-b border-border px-4 py-3">
                {otherFates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => dispatch({ type: "SELECT_HOLD", holdId: c.holdId })}
                    className="block w-full break-words rounded-sm border border-primary/40 bg-primary/10 px-3 py-2 text-left text-[12px] text-primary"
                  >
                    Fate unpaid — {c.headline}
                  </button>
                ))}
              </div>
            )}

            {showOrders && (
              <section className="min-w-0 space-y-3 overflow-hidden border-b border-border px-4 py-3">
                <p className="text-[13px] leading-relaxed text-foreground">
                  {jobLine}
                </p>
                {(canMove || canIssueStance || canStorm || canSally || canRazeStay) &&
                  !isLocked && (
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {canMove && (
                      <OrderButton
                        label={
                          marchDestName ? `March to ${marchDestName}` : "March"
                        }
                        hint="Click a glowing neighbour on the map to send them there this turn."
                        active={marching}
                        spendsTurn
                        onClick={startMarch}
                      />
                    )}
                    {canIssueStance && (
                      <OrderButton
                        label="Rest here"
                        hint="Spend the turn recovering. They will not march."
                        active={singleArmyStanceOrder === "rest"}
                        spendsTurn
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
                            : "Dig in here"
                        }
                        hint={
                          singleSelected &&
                          holdRuntime?.siege?.besiegerFaction ===
                            singleSelected.faction
                            ? "Defend the siege camp. They will not march."
                            : "Fortify this seat. They will not march."
                        }
                        active={singleArmyStanceOrder === "fortify"}
                        spendsTurn
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
                    {canStorm && (
                      <OrderButton
                        label="Storm the walls"
                        hint="Assault the castle this turn instead of starving it."
                        active={stormActive}
                        spendsTurn
                        onClick={() =>
                          dispatch({
                            type: "SET_STORM_ORDER",
                            armyId: singleSelected!.id,
                            active: !stormActive,
                          })
                        }
                      />
                    )}
                    {canSally && (
                      <OrderButton
                        label="Ride out"
                        hint="The garrison attacks the besiegers this turn."
                        active={sallyActive}
                        spendsTurn
                        onClick={() =>
                          dispatch({
                            type: "SET_SALLY_ORDER",
                            holdId: selectedHoldId,
                            active: !sallyActive,
                          })
                        }
                      />
                    )}
                    {canRazeStay && (
                      <OrderButton
                        label={razeActive ? "Do not burn it" : "Burn this seat"}
                        hint="Raze the seat this turn. It will not feed or shelter anyone after."
                        active={razeActive}
                        spendsTurn
                        onClick={() => {
                          if (!selectedHoldId) return;
                          const army = selectedArmies.find((a) =>
                            canRaze(a, selectedHoldId, holdRuntime).ok
                          );
                          if (!army) return;
                          dispatch({
                            type: "SET_RAZE_ORDER",
                            armyId: army.id,
                            holdId: selectedHoldId,
                            active: !razeActive,
                          });
                        }}
                      />
                    )}
                    {marchDestIds.length > 0 && (
                      <OrderButton
                        label="Cancel march"
                        hint="They will stay here with no job until you give them one."
                        onClick={cancelMarch}
                      />
                    )}
                  </div>
                )}
                {(canGarrison ||
                  canAbandon ||
                  canIssueStance ||
                  canCombine ||
                  canSplit ||
                  canChangeCommander) &&
                  !isLocked && (
                  <div className="min-w-0 space-y-1.5">
                    <div className="text-[11px] text-muted-foreground">Organize</div>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                    {canGarrison && (
                      <OrderButton
                        label="Post men on the walls"
                        hint="Move soldiers from this host into the garrison."
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
                        label="Leave the walls empty"
                        hint="Take the garrison with you and abandon this conquered seat."
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
                    {canIssueStance && (
                      <OrderButton
                        label="Speak to the men"
                        hint="A speech to raise morale. Once per host per turn. They can still march."
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
                    {canCombine && (
                      <OrderButton
                        label="Join into one host"
                        hint="Merge the selected hosts at this seat."
                        onClick={() => dispatch({ type: "COMBINE_ARMIES" })}
                      />
                    )}
                    {canSplit && (
                      <OrderButton
                        label="Divide this host"
                        hint="Split men and captains into two hosts."
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
                        label="Change who leads"
                        hint="Pick another captain for this host."
                        onClick={() =>
                          dispatch({
                            type: "OPEN_COMMANDER_CHANGE",
                            armyId: singleSelected!.id,
                          })
                        }
                      />
                    )}
                    </div>
                  </div>
                )}
              </section>
            )}

            {garrisonable && holdRuntime && castleSeed && (
              <RailBlock
                title="Seat"
                hint={
                  holdRuntime.siege
                    ? `${garrisonMen.toLocaleString()} · siege`
                    : `${garrisonMen.toLocaleString()} on walls`
                }
              >
                <p className="break-words text-[12px] text-muted-foreground">
                  Held by {holdRuntime.controller ?? "no one"}
                  {garrisonMen > 0
                    ? ` · ${garrisonMen.toLocaleString()} on the walls`
                    : " · walls unmanned"}
                </p>
                {holdRuntime.siege && (
                  <p className="mt-2 break-words text-[12px] font-medium text-bad">
                    Under siege · turn {holdRuntime.siege.turns} ·{" "}
                    {holdRuntime.siege.besiegerFaction === "north"
                      ? "the North"
                      : "the Westerlands"}
                  </p>
                )}
                {openPledge && (
                  <div className="mt-2 break-words rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-2 text-[12px] leading-relaxed text-primary">
                    Seat taken — walls empty.
                    <div className="mt-1 text-primary/80">
                      Posting men is optional.
                    </div>
                  </div>
                )}
                {underStrengthSiege && (
                  <div className="mt-2 break-words rounded-sm border border-bad/40 bg-bad/10 px-2.5 py-2 text-[12px] leading-relaxed text-bad">
                    Too few to besiege ({underStrengthSiege.men.toLocaleString()} /{" "}
                    {underStrengthSiege.required.toLocaleString()}).
                  </div>
                )}
                {holdRuntime.siege && (
                  <div className="mt-2 min-w-0">
                    <TermsBlock
                      state={state}
                      dispatch={dispatch}
                      holdId={selectedHoldId}
                      faction={myFaction}
                    />
                  </div>
                )}
                {myFateHere && (
                  <div className="mt-2 min-w-0">
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
                  <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
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
                        label={`Talk to ${parleyLabel}`}
                        hint={`Open a parley with ${parleyLabel}.`}
                        onClick={() => void openCastleParley()}
                      />
                    )}
                  </div>
                )}
                {parleyError && (
                  <p className="mt-2 break-words text-[12px] text-bad">{parleyError}</p>
                )}
                <p className="mt-2 break-words text-[12px] text-muted-foreground">
                  {garrisonMen.toLocaleString()} / {castleSeed.capacity.toLocaleString()}{" "}
                  capacity
                  {holdRuntime.foodDaysRemaining != null
                    ? ` · food ~${holdRuntime.foodDaysRemaining} days`
                    : ""}
                </p>
                {holdRuntime.supplies && (
                  <p className="mt-1 break-words text-[12px] italic text-muted-foreground">
                    {holdRuntime.supplies}
                  </p>
                )}
              </RailBlock>
            )}

            {controllableArmies.length > 1 && (
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

            <RailBlock
              title="Hosts"
              hint={
                selectedArmyIds.length > 0
                  ? `${selectedArmyIds.length} selected`
                  : northHere.length + westHere.length > 0
                    ? `${northHere.length + westHere.length} here`
                    : "none"
              }
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
            </RailBlock>

            {trait && (
              <RailBlock title="Country" hint={trait.name}>
                <p className="break-words text-[13px] leading-relaxed text-muted-foreground">
                  {forageAtHold(state.forage, hold.id)}
                </p>
                <p className="mt-2 break-words text-[12px] leading-relaxed text-muted-foreground">
                  {trait.blurb}
                </p>
              </RailBlock>
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

function RailBlock({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden border-b border-border px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[12px] font-medium text-foreground">{title}</h3>
        {hint && (
          <span className="min-w-0 truncate text-[11px] font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
