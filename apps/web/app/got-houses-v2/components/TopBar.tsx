"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Flag,
  Info,
  MessageCircle,
  ScrollText,
  Swords,
} from "lucide-react";
import type { GameState, GameAction, Faction } from "../types";
import {
  victoryProgress,
  VICTORY_TURN_LIMIT,
  WEST_RIVERLANDS_NEEDED,
  NORTH_PRIZE_HOLD_TURNS,
} from "../lib/victory";
import { blockingMessage } from "../lib/pending-choices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/hint";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  deferAdjudicate?: boolean;
}

const PHASE_COPY: Record<string, string> = {
  planning: "Planning",
  resolving: "Adjudicating",
  retreat: "Retreat",
  rename_commanders: "Rename commanders",
  ended: "War ended",
};

export default function TopBar({ state, dispatch, deferAdjudicate }: Props) {
  const { turn, north, westerlands, adminMode, activeFaction, phase } = state;
  const inPlanningPhase = phase === "planning";
  const progress = victoryProgress(state);
  const currentOrders = activeFaction === "north" ? north : westerlands;
  const currentSubmitted =
    activeFaction === "north" ? north.submitted : westerlands.submitted;
  const blockedBy = blockingMessage(state.pendingChoices, activeFaction);
  const factionLabel =
    activeFaction === "north" ? "The North" : "The Westerlands";

  function handleSubmit() {
    dispatch({ type: "SUBMIT_FACTION", faction: activeFaction, deferAdjudicate });
  }

  const submitLocked = currentSubmitted || !inPlanningPhase || !!blockedBy;
  const submitLabel = !inPlanningPhase
    ? PHASE_COPY[phase] ?? "In progress"
    : currentSubmitted
      ? "Turn committed"
      : blockedBy
        ? "Fate unpaid"
        : "Commit this turn";

  return (
    <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-card/90 px-2 backdrop-blur sm:gap-3 sm:px-3">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 gap-1 px-2 text-muted-foreground"
      >
        <Link href="/" title="Leave the table">
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Table</span>
        </Link>
      </Button>

      <div className="min-w-0 overflow-hidden">
        <div className="truncate font-display text-lg font-semibold leading-none tracking-wide text-foreground">
          Riverlands
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden text-[12px] text-muted-foreground">
          <span className="shrink-0">
            Turn {turn}
            <span className="text-muted-foreground/60"> / {VICTORY_TURN_LIMIT}</span>
          </span>
          <span aria-hidden className="hidden text-border sm:inline">
            ·
          </span>
          <span className="hidden truncate sm:inline">{PHASE_COPY[phase] ?? phase}</span>
        </div>
      </div>

      <div className="mx-1 hidden h-8 w-px shrink-0 bg-border md:block" />

      {adminMode ? (
        <div className="flex shrink-0 overflow-hidden rounded-sm border border-border">
          {(["north", "westerlands"] as Faction[]).map((f) => {
            const active = activeFaction === f;
            const submitted = f === "north" ? north.submitted : westerlands.submitted;
            return (
              <Hint
                key={f}
                label={
                  submitted
                    ? `${f === "north" ? "North" : "West"} has locked orders`
                    : `Issue orders as ${f === "north" ? "the North" : "the Westerlands"}`
                }
              >
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SWITCH_FACTION", faction: f })}
                  className={cn(
                    "flex h-8 items-center gap-1.5 px-2 text-[12px] font-medium sm:px-3",
                    f === "north" ? "text-north" : "text-west",
                    active
                      ? f === "north"
                        ? "bg-north-deep"
                        : "bg-west-deep"
                      : "bg-transparent text-muted-foreground"
                  )}
                >
                  {f === "north" ? "North" : "West"}
                  {submitted ? " ✓" : ""}
                </button>
              </Hint>
            );
          })}
        </div>
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-sm border px-2 py-1 sm:px-2.5",
            activeFaction === "north"
              ? "border-north/30 bg-north-deep/60 text-north"
              : "border-west/30 bg-west-deep/60 text-west"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              activeFaction === "north" ? "bg-north" : "bg-west"
            )}
          />
          <span className="hidden text-[12px] font-medium sm:inline">{factionLabel}</span>
        </div>
      )}

      <div className="min-w-0 flex-1" />

      <Hint
        label={
          blockedBy ??
          (currentSubmitted
            ? "You have committed. The field is judged when both sides have."
            : "Commit this turn. Both sides must, then the field is judged.")
        }
      >
        <Button
          type="button"
          size="sm"
          disabled={submitLocked}
          onClick={handleSubmit}
          className="h-8 max-w-[9.5rem] shrink-0 overflow-hidden truncate px-2.5 text-[12px] font-semibold sm:max-w-none sm:px-3"
        >
          {submitLabel}
          {!currentSubmitted && inPlanningPhase && currentOrders.orders.length > 0
            ? ` (${currentOrders.orders.length})`
            : ""}
        </Button>
      </Hint>

      {inPlanningPhase && (
        <Hint label="Speak with lords, castellans, and your war council">
          <Button
            type="button"
            variant={state.talkPickerOpen || state.openConversationIds.length > 0 ? "secondary" : "outline"}
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2 text-[12px] sm:px-2.5"
            onClick={() => dispatch({ type: "TOGGLE_TALK_PICKER" })}
          >
            <MessageCircle className="size-3.5" />
            <span className="hidden md:inline">Talk</span>
            {state.openConversationIds.length > 0 && (
              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                {state.openConversationIds.length}
              </Badge>
            )}
          </Button>
        </Hint>
      )}

      {(state.battleReports ?? []).length > 0 && (
        <Hint label="Read every battle that has been fought">
          <Button
            type="button"
            variant={state.battleLogOpen ? "secondary" : "outline"}
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2 text-[12px] sm:px-2.5"
            onClick={() => dispatch({ type: "TOGGLE_BATTLE_LOG" })}
          >
            <Swords className="size-3.5" />
            <span className="hidden md:inline">Battles</span>
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {state.battleReports.length}
            </Badge>
          </Button>
        </Hint>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2 text-[12px] sm:px-2.5"
            title="How this war is won or lost"
          >
            <Flag className="size-3.5" />
            <span className="hidden md:inline">Ends</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(20rem,calc(100vw-24px))] max-w-[min(20rem,calc(100vw-24px))] space-y-3 break-words text-[13px] leading-relaxed text-muted-foreground"
        >
          <div className="font-display text-base text-foreground">How the war ends</div>
          <p>
            Robb wins on turn {VICTORY_TURN_LIMIT} if the war is still open. It is
            turn {progress.turn}.
          </p>
          <p>
            Robb also wins if he takes King&apos;s Landing or Casterly Rock and
            holds it {NORTH_PRIZE_HOLD_TURNS} turns.
            {progress.northPrize
              ? ` Holding ${progress.northPrize.name} (${progress.northPrize.turnsHeld}/${NORTH_PRIZE_HOLD_TURNS}).`
              : " Neither seat is his yet."}
          </p>
          <p>
            Tywin wins if he holds {WEST_RIVERLANDS_NEEDED} riverland seats
            including Riverrun and the Twins.{" "}
            {progress.westRiverlands.count}/{WEST_RIVERLANDS_NEEDED}
            {progress.westRiverlands.hasRiverrun ? " · Riverrun" : " · no Riverrun"}
            {progress.westRiverlands.hasTwins ? " · Twins" : " · no Twins"}.
          </p>
          <p>
            If one side has no army left, the other wins. North{" "}
            {progress.northMen.toLocaleString()} · West{" "}
            {progress.westMen.toLocaleString()}.
          </p>
          <p>If Robb dies, Tywin wins. {progress.robbAlive ? "Robb lives." : "Robb is dead."}</p>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            title="More table tools"
          >
            <Info className="size-4" />
            <span className="sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => dispatch({ type: "SET_BRIEFING_OPEN", open: true })}
          >
            <ScrollText className="size-4" />
            Last briefing
          </DropdownMenuItem>
          {(state.battleReports ?? []).length > 0 && (
            <DropdownMenuItem
              onClick={() => dispatch({ type: "TOGGLE_BATTLE_LOG" })}
            >
              <Swords className="size-4" />
              Battles
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => dispatch({ type: "TOGGLE_ADMIN" })}>
            {adminMode ? "Leave hot-seat admin" : "Hot-seat admin"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
