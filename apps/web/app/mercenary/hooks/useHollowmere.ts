"use client";

import { useEffect, useState } from "react";
import type { GroupId, PlaceId, Sigil, Trade, World } from "../data/hollowmere";
import { neighbors, PLACES } from "../data/hollowmere";
import { TUTORIAL_STEPS } from "../lib/play";
import {
  acceptChip,
  acceptDeal,
  acceptRecruits,
  advanceTutorial,
  applyFight,
  confirmSuggestion,
  counterDeal,
  declineDeal,
  dismissChip,
  found,
  hide,
  ignoreSuggestion,
  openingFlags,
  pillage,
  publicView,
  rest,
  reviveSave,
  SAVE_KEY,
  setChip,
  skipTutorial,
  workFields,
  type PlayResult,
} from "../lib/play";
import { applyFind } from "../lib/play";
import { freshGame, resolveWeek } from "../lib/sim";

function persist(world: World) {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, world }));
}

function markAction(world: World, text: string): World {
  if (world.company) world.company.actionUsed = true;
  world.decisions.push({ week: world.week, text });
  return world;
}

function countMen(world: World): number {
  return world.company?.units.reduce((sum, unit) => sum + unit.headcount, 0) ?? 0;
}

function weekNote(before: World, after: World): string {
  const left = after.company?.bread ?? 0;
  const lost = countMen(before) - countMen(after);
  const captiveDeaths =
    before.people.filter((person) => person.alive && person.forceId === "captive").length -
    after.people.filter((person) => person.alive && person.forceId === "captive").length;
  const fed = after.company?.paidThisWeek !== false && (before.company?.bread ?? 0) !== left;
  let text = fed
    ? `The company ate this week. ${left} bread is left.`
    : `Not enough bread. ${left} bread is left.`;
  if (lost > 0) text += ` ${lost} left the company.`;
  if (captiveDeaths > 0) text += captiveDeaths === 1 ? " A captive died." : ` ${captiveDeaths} captives died.`;
  return text;
}

export function useHollowmere() {
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(SAVE_KEY);
    const old = window.localStorage.getItem("mercenary-band-v1");
    const revived = raw ? reviveSave(JSON.parse(raw)) : null;
    if (revived) setWorld(revived);
    else setWorld(freshGame());
    void old;
  }, []);

  function commit(next: World) {
    setWorld(next);
    persist(next);
    setError(null);
  }

  function apply(result: PlayResult) {
    if (!result.ok) setError(result.error);
    else commit(result.world);
  }

  return {
    world,
    error,
    busy,
    view: world ? publicView({ ...world, flags: openingFlags(world) }) : null,
    reset() {
      window.localStorage.removeItem(SAVE_KEY);
      commit(freshGame());
    },
    found(input: Parameters<typeof found>[1]) {
      if (!world) return;
      apply(found(world, input));
    },
    acceptDeal(id: string) {
      if (!world) return;
      const deal = world.deals.find((item) => item.id === id);
      const result = acceptDeal(world, id);
      if (!result.ok) setError(result.error);
      else {
        if (deal) result.world.decisions.push({ week: result.world.week, text: `You took the ${deal.amount} ${deal.currency}.` });
        commit(result.world);
      }
    },
    counterDeal(id: string, amount: number) {
      if (!world) return;
      const deal = world.deals.find((item) => item.id === id);
      const result = counterDeal(world, id, amount);
      if (!result.ok) setError(result.error);
      else {
        const currency = deal?.currency ?? "gold";
        result.world.decisions.push({ week: result.world.week, text: `You asked for ${amount} ${currency}.` });
        commit(result.world);
      }
    },
    declineDeal(id: string) {
      if (!world) return;
      apply(declineDeal(world, id));
    },
    move(to: PlaceId) {
      if (!world?.company?.founded || world.company.moveUsed) return;
      if (!neighbors(world.company.location).includes(to)) return;
      const next = structuredClone(world);
      next.company!.location = to;
      next.company!.lastSeen = to;
      next.company!.moveUsed = true;
      next.deals = next.deals.filter((deal) => deal.status === "accepted");
      next.decisions.push({ week: next.week, text: `Marched to ${PLACES[to].name}.` });
      commit(next);
    },
    rest() {
      if (!world?.company || world.company.actionUsed) return;
      const result = rest(world, "own");
      if (!result.ok) setError(result.error);
      else commit(markAction(result.world, "The company rested."));
    },
    work() {
      if (!world?.company || world.company.actionUsed) return;
      const result = workFields(world);
      if (!result.ok) setError(result.error);
      else commit(markAction(result.world, "The company worked the fields."));
    },
    hide() {
      if (!world?.company || world.company.actionUsed) return;
      commit(markAction(hide(world), "The company stays hidden until next week."));
    },
    pillage() {
      if (!world?.company || world.company.actionUsed) return;
      const result = pillage(world, world.company.location);
      if (!result.ok) setError(result.error);
      else commit(markAction(result.world, "The company pillaged this place."));
    },
    async search() {
      if (!world?.company || world.company.actionUsed) return;
      setBusy("The search is being judged.");
      const place = world.company.location;
      let kind: "nothing" | "camp" | "bandits" = "nothing";
      try {
        const res = await fetch("/api/mercenary/forest/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: world.company.name,
            place,
            ground: "wild ground",
            band: "A band may be camped here.",
            bandAlive: world.people.some((person) => person.alive && person.groupId === "pack"),
            searched: world.searches[place] ?? 0,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { found?: string };
          if (data.found === "camp" || data.found === "bandits" || data.found === "nothing") kind = data.found;
        }
      } catch {
        kind = "nothing";
      }
      const before = world.company.bread;
      const found = applyFind(world, kind);
      const held = found.company?.bread ?? before;
      const gained = held - before;
      const line =
        kind === "camp"
          ? "You found the camp."
          : kind === "bandits"
            ? "You found the band."
            : `The search found ${gained} bread. You hold ${held}.`;
      commit(markAction(found, line));
      setBusy(null);
    },
    fight(choice: "stand" | "take") {
      if (!world?.pendingBattle || !world.company) return;
      const kind = world.pendingBattle.kind;
      const group: GroupId = kind === "pursuit" ? "crown-guards" : kind === "pillage" ? "thorn-peasants" : "pack";
      const fought = applyFight(world, choice === "stand"
        ? { killed: 0, wounded: 0, inHand: 0, atLarge: 1, group }
        : { killed: 0, wounded: 1, inHand: 1, atLarge: 0, group });
      fought.world.pendingBattle = null;
      if (fought.world.company) {
        fought.world.company.fought = true;
        fought.world.company.actionUsed = true;
      }
      fought.world.decisions.push({
        week: fought.world.week,
        text: fought.stood ? "You held the ground. They got away." : "You took one of them in hand.",
      });
      commit(fought.world);
    },
    followTeaching() {
      if (!world?.company || world.tutorialDone) return;
      const step = TUTORIAL_STEPS[world.tutorialStep];
      if (step === "end") {
        const resolved = resolveWeek(world, { raidAsBattle: false });
        resolved.decisions.push({ week: resolved.week, text: weekNote(world, resolved) });
        commit(advanceTutorial(resolved));
        return;
      }
      if (step === "fenn") {
        const next = advanceTutorial(world);
        const gained = (next.company?.bread ?? 0) - world.company.bread;
        if (gained > 0) next.decisions.push({ week: next.week, text: `Fenn gave ${gained} bread.` });
        commit(next);
        return;
      }
      if (step === "volunteers") {
        const place = world.company.location;
        const group = place === "salt-ferry" ? "ferry-peasants" : place === "crownmarket" ? "crown-peasants" : "thorn-peasants";
        const before = world.company.units.length;
        const recruited = acceptRecruits(world, group, 2, "spearmen");
        if (!recruited.ok) {
          setError(recruited.error);
          return;
        }
        const opened = (recruited.world.company?.units.length ?? before) > before;
        commit(advanceTutorial(markAction(recruited.world, opened ? "Two spearmen joined as The Recruits." : "Two spearmen joined.")));
        return;
      }
      commit(advanceTutorial(world));
    },
    endWeek() {
      if (!world) return;
      const resolved = resolveWeek(world, { raidAsBattle: true });
      resolved.decisions.push({ week: resolved.week, text: weekNote(world, resolved) });
      commit(resolved);
    },
    skipTutorial() {
      if (!world) return;
      commit(skipTutorial(world));
    },
    advanceTutorial() {
      if (!world) return;
      commit(advanceTutorial(world));
    },
    recruit(group: "thorn-peasants" | "ferry-peasants" | "crown-peasants", trade: Trade) {
      if (!world?.company || world.company.actionUsed) return;
      const before = world.company.units.length;
      const result = acceptRecruits(world, group, 2, trade);
      if (!result.ok) setError(result.error);
      else {
        const opened = (result.world.company?.units.length ?? before) > before;
        commit(markAction(result.world, opened ? "Two spearmen joined as The Recruits." : "Two spearmen joined."));
      }
    },
    talk(text: string) {
      if (!world) return;
      const chip = /recruit|men/i.test(text) ? { label: "Take that as recruiting?", action: "recruit" } : null;
      let next = setChip(world, chip);
      if (!next.tutorialDone && TUTORIAL_STEPS[next.tutorialStep] === "speech") next = advanceTutorial(next);
      const said = text.trim();
      if (said) next.decisions.push({ week: next.week, text: `You said: ${said}` });
      commit(next);
    },
    acceptChip() {
      if (!world) return;
      apply(acceptChip(world));
    },
    dismissChip() {
      if (!world) return;
      commit(dismissChip(world));
    },
    ignoreSuggestion() {
      if (!world) return;
      commit(ignoreSuggestion(world));
    },
    confirmSuggestion() {
      if (!world) return;
      apply(confirmSuggestion(world));
    },
  };
}

export type HollowmereGame = ReturnType<typeof useHollowmere>;
