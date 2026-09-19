"use client";

import type { Faction, GameAction, GameState } from "../types";
import { HOLDS_MAP } from "../data/holds";
import { armyMen } from "../lib/forage";
import { blockingChoicesFor } from "../lib/pending-choices";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  viewerFaction?: Faction;
}

const FACTION_NAME: Record<Faction, string> = {
  north: "The North",
  westerlands: "The Westerlands",
};

export default function TheaterOverview({ state, dispatch, viewerFaction }: Props) {
  const myFaction = state.adminMode
    ? state.activeFaction
    : viewerFaction ?? state.activeFaction;
  const myArmies = state.armies.filter((a) => a.faction === myFaction);
  const choices = blockingChoicesFor(state.pendingChoices, myFaction);
  const orders = myFaction === "north" ? state.north : state.westerlands;
  const orderedCount = orders.orders.length;

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-6 overflow-hidden p-4">
        <div>
          <h2 className="font-display text-[22px] font-semibold leading-tight text-foreground">
            The theater
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Click a hold on the map to inspect it. Then pick a host and issue
            orders from the right rail.
          </p>
        </div>

        {choices.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-medium text-primary">
              Needs a decision
            </h3>
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => dispatch({ type: "SELECT_HOLD", holdId: c.holdId })}
                className="block w-full break-words rounded-sm border border-primary/40 bg-primary/10 px-3 py-2 text-left text-[13px] text-primary hover:bg-primary/15"
              >
                {c.headline}
              </button>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[11px] font-medium text-muted-foreground">
              {FACTION_NAME[myFaction]} · {myArmies.length}{" "}
              {myArmies.length === 1 ? "host" : "hosts"}
            </h3>
            <span className="font-mono text-[11px] text-muted-foreground">
              {orders.submitted
                ? "Orders locked"
                : orderedCount > 0
                  ? `${orderedCount} marching`
                  : "No marches yet"}
            </span>
          </div>
          {myArmies.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No field hosts remain.
            </p>
          ) : (
            <ul className="space-y-1">
              {myArmies.map((army) => {
                const hold = HOLDS_MAP.get(army.holdId);
                const hasOrder = orders.orders.some((o) => o.armyId === army.id);
                return (
                  <li key={army.id}>
                    <Hint label={`Inspect ${army.name} at ${hold?.name ?? "the field"}`}>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "SELECT_ARMY",
                            armyId: army.id,
                            shift: false,
                          })
                        }
                        className="flex w-full items-baseline justify-between gap-2 rounded-sm border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-foreground">
                            {army.name}
                          </span>
                          <span className="text-[12px] text-muted-foreground">
                            {hold?.name ?? army.holdId}
                            {hasOrder ? " · marching" : ""}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
                          {armyMen(army).toLocaleString()}
                        </span>
                      </button>
                    </Hint>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-[11px] font-medium text-muted-foreground">
            How a turn works
          </h3>
          <ol className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Inspect.</span>{" "}
              Click a hold, then a host.
            </li>
            <li>
              <span className="font-medium text-foreground">2. Order.</span>{" "}
              March, rest, fortify, or work the walls. Hover a button for what
              it does.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Lock.</span>{" "}
              Submit when the plan is set. Both sides lock, then the field is
              adjudicated.
            </li>
          </ol>
          <Hint label="Open a short briefing of last turn and any unpaid fates">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[12px]"
              onClick={() => dispatch({ type: "SET_BRIEFING_OPEN", open: true })}
            >
              Open last briefing
            </Button>
          </Hint>
        </section>
      </div>
    </ScrollArea>
  );
}
