"use client";

import { useEffect, useRef, useState } from "react";
import {
  acceptWork,
  applyAftermath,
  applyForage,
  applyOpeningReputation,
  applyOutcome,
  applyTraining,
  banditDescription,
  beginResolution,
  canClaimReward,
  chooseTypes,
  claimReward,
  commitApproach,
  companyDescription,
  defaultWeekPlan,
  describeAction,
  dequeue,
  enqueue,
  fallbackForageMeals,
  finishWeek,
  freshGame,
  headcount,
  nameStartingUnits,
  nextContractTemplate,
  openBattle,
  refundApproach,
  rememberLeader,
  retreatQuiet,
  retreatStartsFight,
  offerContract,
  setCompanyName,
  setDeed,
  setMovement,
  setRation,
  setWeekOrder,
  takeContract,
  slipPast,
  stepQueue,
  takeForestForage,
  validateOutcome,
} from "../lib/engine";
import { NODES } from "../data/map";
import type { BaseTypeId } from "../data/wiki";
import { REPUTATION_KEYS, type Aftermath, type DeedOrder, type GameState, type MovementOrder, type ReputationShift, type WeekAction, type WeekOrder } from "../lib/types";

const KEY = "mercenary-band-v1";

function revivePlan(parsed: GameState) {
  if (parsed.weekPlan?.movement && parsed.weekPlan?.deed) return parsed.weekPlan;
  const plan = defaultWeekPlan();
  for (const action of parsed.queue ?? []) {
    if (action.kind === "move") plan.movement = { kind: "march", to: action.to };
    else if (action.kind !== "rest") plan.deed = action;
  }
  return plan;
}

function revive(parsed: GameState): GameState {
  const blank = freshGame();
  return {
    ...blank,
    ...parsed,
    lateBasic: parsed.lateBasic ?? 0,
    lateGood: parsed.lateGood ?? 0,
    weekPlan: revivePlan(parsed),
    weeksSinceRest: parsed.weeksSinceRest ?? 0,
    weeksDoubleRest: parsed.weeksDoubleRest ?? 0,
    bandAt: parsed.bandAt ?? "blackwood",
    payAt: parsed.payAt ?? "millcross",
    contract: parsed.contract ?? null,
    contractStep: parsed.contractStep ?? 0,
    hungerNote: parsed.hungerNote ?? null,
    weekScene: parsed.weekScene ?? null,
    drillDiffs: Array.isArray(parsed.drillDiffs) ? parsed.drillDiffs : [],
    reputationShift: Array.isArray(parsed.reputationShift) ? parsed.reputationShift : [],
    yearClosing: parsed.yearClosing ?? null,
    units: (parsed.units ?? []).map((unit) => ({
      ...unit,
      lines: Array.isArray(unit.lines) ? unit.lines.filter((line) => typeof line === "string" && line.trim()) : [],
    })),
    bandits: parsed.bandits
      ? {
          ...parsed.bandits,
          lines: Array.isArray(parsed.bandits.lines) ? parsed.bandits.lines.filter((line) => typeof line === "string" && line.trim()) : [],
        }
      : null,
  };
}

async function errorText(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof data?.error === "string" ? data.error : `The call failed (${res.status}).`;
}

export function useMercenary() {
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<GameState | null>(null);

  function commit(next: GameState) {
    ref.current = next;
    setState(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GameState;
        if (parsed.version === 1 && parsed.companyName !== undefined) {
          const game = revive(parsed);
          ref.current = game;
          setState(game);
          return;
        }
      }
    } catch {
      /* start fresh */
    }
    const game = freshGame();
    ref.current = game;
    setState(game);
  }, []);

  async function pullReputation(current: GameState, justHappened: string): Promise<{ state: GameState; failed: string | null }> {
    const results = await Promise.all(
      REPUTATION_KEYS.map(async (key) => {
        const res = await fetch("/api/mercenary/reputation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            companyName: current.companyName,
            current: current.reputation[key],
            decisions: current.decisions,
            justHappened,
          }),
        });
        if (!res.ok) return { key, error: await errorText(res) };
        const data = (await res.json()) as { text?: string };
        return { key, text: data.text ?? "" };
      })
    );
    let next = current;
    let failed: string | null = null;
    for (const result of results) {
      if ("error" in result) {
        if (result.error) failed = result.error;
        continue;
      }
      if (!result.text.trim()) {
        failed = "A standing came back empty.";
        continue;
      }
      next = {
        ...next,
        reputation: { ...next.reputation, [result.key]: result.text.trim() },
      };
    }
    return { state: next, failed };
  }

  function shifts(before: GameState, after: GameState): ReputationShift[] {
    return REPUTATION_KEYS.filter((key) => after.reputation[key] && after.reputation[key] !== before.reputation[key]).map((key) => ({
      key,
      text: after.reputation[key],
    }));
  }

  async function refreshReputation(base: GameState, happened: string) {
    const pulled = await pullReputation(base, happened);
    const current = ref.current;
    if (!current) return;
    commit({
      ...current,
      reputation: pulled.state.reputation,
      reputationShift: shifts(base, pulled.state).length ? shifts(base, pulled.state) : current.reputationShift,
    });
    if (pulled.failed) setError(pulled.failed);
  }

  async function closeYear(current: GameState): Promise<string | null> {
    try {
      const res = await fetch("/api/mercenary/year/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: current.companyName,
          units: current.units.map((unit) => ({ name: unit.name, count: unit.count, lines: unit.lines })),
          decisions: current.decisions,
          reputation: current.reputation,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { closing?: string };
      return data.closing?.trim() || null;
    } catch {
      return null;
    }
  }

  async function narrateWeek(state: GameState): Promise<GameState> {
    const plan = state.weekPlan;
    const place = NODES[state.location];
    const fought = state.moraleFromBattle;
    const doubleRest = plan.movement.kind === "rest" && plan.deed.kind === "rest" && !state.movedThisWeek;
    let closed = finishWeek(state);
    if (closed.phase === "wiped") return closed;
    const movement = plan.movement.kind === "march" ? `Marched to ${NODES[plan.movement.to].name}` : "Rested where they were";
    const deed = describeAction(plan.deed.kind === "rest" ? { kind: "rest" } : plan.deed);
    const hungry = /hungry|starving/i.test(closed.hungerNote ?? "");
    if (!fought) {
      setBusy(doubleRest ? "They are settling in." : "The week is being written.");
      try {
        const [sceneRes, conditionRes] = await Promise.all([
          fetch("/api/mercenary/week/scene", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              doubleRest,
              movement,
              deed,
              place: place.name,
              ground: place.ground,
              kind: place.kind,
              hungerNote: closed.hungerNote,
              company: companyDescription(state),
              watched: !!state.bandits && state.location === state.bandAt,
            }),
          }),
          fetch("/api/mercenary/week/condition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              movement,
              deed,
              doubleRest,
              place: place.name,
              ground: place.ground,
              kind: place.kind,
              hungerNote: closed.hungerNote,
              hungry,
              weeksSinceRest: closed.weeksSinceRest,
              weeksDoubleRest: closed.weeksDoubleRest,
              morale: closed.morale,
              condition: closed.condition,
              stance: closed.stance,
              fought: false,
            }),
          }),
        ]);
        if (sceneRes.ok) {
          const data = (await sceneRes.json()) as { scene?: string };
          if (data.scene?.trim()) closed = { ...closed, weekScene: data.scene.trim() };
        }
        if (conditionRes.ok) {
          const data = (await conditionRes.json()) as { morale?: string; condition?: string; stance?: string };
          if (data.morale && data.condition && data.stance) {
            closed = { ...closed, morale: data.morale, condition: data.condition, stance: data.stance };
          }
        }
      } catch {
        /* The week's rules already stand. */
      }
    } else if (closed.lastBrief) {
      closed = { ...closed, weekScene: closed.lastBrief };
    }
    if (closed.phase === "year-end" && !closed.yearClosing) {
      setBusy("The year is being closed.");
      const closing = await closeYear(closed);
      if (closing) closed = { ...closed, yearClosing: closing };
    }
    return closed;
  }

  async function continueWeek(start: GameState) {
    let current = start.resolveIndex === 0 ? beginResolution(start) : start;
    while (true) {
      const step = stepQueue(current);
      if (step.kind === "forest") {
        commit(step.state);
        setBusy(null);
        return;
      }
      if (step.kind === "forage") {
        setBusy("They are out in the trees.");
        const place = NODES[step.state.location];
        const men = headcount(step.state.units);
        let meals = fallbackForageMeals(men);
        let account = `They foraged in ${place.name} and brought back ${meals} rations.`;
        let spotted = false;
        try {
          const res = await fetch("/api/mercenary/forest/forage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              men,
              place: place.name,
              ground: place.ground,
              bandits: step.state.bandits?.count ?? 0,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { meals?: number; account?: string; spotted?: boolean };
            if (typeof data.meals === "number" && Number.isFinite(data.meals)) meals = data.meals;
            if (typeof data.account === "string" && data.account.trim()) account = data.account.trim();
            if (data.spotted) spotted = true;
          }
        } catch {
          /* The fallback ration roll already stands. */
        }
        const applied = applyForage(step.state, meals, account);
        if (!applied.ok) {
          commit(current);
          setError(applied.error);
          setBusy(null);
          return;
        }
        if (spotted && applied.state.bandits && applied.state.location === applied.state.bandAt) {
          commit({ ...applied.state, screen: "forest" });
          setBusy(null);
          return;
        }
        current = applied.state;
        continue;
      }
      if (step.kind === "train") {
        setBusy("The drill is being written down.");
        const units = step.unitIds.map((id) => current.units.find((unit) => unit.id === id));
        const res = await fetch("/api/mercenary/train", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "apply",
            drill: step.drill,
            companyName: step.state.companyName,
            place: NODES[step.state.location].name,
            ground: NODES[step.state.location].ground,
            units,
          }),
        });
        if (!res.ok) {
          commit(current);
          setError(await errorText(res));
          setBusy(null);
          return;
        }
        const data = (await res.json()) as { lines: Record<string, string[]> };
        const applied = applyTraining(step.state, data.lines);
        if (!applied.ok) {
          commit(current);
          setError(applied.error);
          setBusy(null);
          return;
        }
        current = applied.state;
        continue;
      }
      if (step.kind === "done") {
        const narrated = await narrateWeek(step.state);
        const latest = ref.current;
        commit({
          ...narrated,
          reputation: latest?.reputation ?? narrated.reputation,
          reputationShift: latest?.reputationShift?.length ? latest.reputationShift : narrated.reputationShift,
        });
        setBusy(null);
        return;
      }
      current = step.state;
    }
  }

  return {
    state,
    busy,
    error,
    clearError: () => setError(null),
    reset() {
      localStorage.removeItem(KEY);
      const game = freshGame();
      commit(game);
      setError(null);
    },
    nameCompany(name: string) {
      if (!ref.current) return;
      const result = setCompanyName(ref.current, name);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        commit(result.state);
      }
    },
    pickTypes(types: BaseTypeId[]) {
      if (!ref.current) return;
      const result = chooseTypes(ref.current, types);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        commit(result.state);
      }
    },
    nameUnits(names: [string, string]) {
      if (!ref.current) return;
      const result = nameStartingUnits(ref.current, names);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        commit(result.state);
      }
    },
    async rollReputation() {
      const current = ref.current;
      if (!current) return;
      setBusy("Word of the company is travelling.");
      setError(null);
      const happened = `Founded ${current.companyName}, a new mercenary company.`;
      const pulled = await pullReputation(current, happened);
      if (pulled.failed) {
        commit(pulled.state);
        setError(pulled.failed);
        setBusy(null);
        return;
      }
      const opened = applyOpeningReputation(pulled.state, pulled.state.reputation);
      if (!opened.ok) {
        commit(pulled.state);
        setError(opened.error);
        setBusy(null);
        return;
      }
      commit(opened.state);
      setBusy(null);
    },
    queue(action: WeekAction) {
      if (!ref.current) return;
      const result = enqueue(ref.current, action);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        commit(result.state);
      }
    },
    unqueue(index: number) {
      if (!ref.current) return;
      const result = dequeue(ref.current, index);
      if (!result.ok) setError(result.error);
      else commit(result.state);
    },
    ration(value: "hearty" | "plain") {
      if (!ref.current) return;
      commit(setRation(ref.current, value));
    },
    move(movement: MovementOrder) {
      if (!ref.current) return;
      const result = setMovement(ref.current, movement);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        commit(result.state);
      }
    },
    act(deed: DeedOrder) {
      if (!ref.current) return;
      const result = setDeed(ref.current, deed);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        commit(result.state);
      }
    },
    order(next: WeekOrder) {
      if (!ref.current) return;
      const result = setWeekOrder(ref.current, next);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        commit(result.state);
      }
    },
    show(screen: GameState["screen"]) {
      if (!ref.current) return;
      commit({ ...ref.current, screen });
    },
    async liveWeek() {
      const current = ref.current;
      if (!current || busy) return;
      setError(null);
      setBusy("The week goes by.");
      await continueWeek(current);
    },
    async suggestDrills(unitIds: [string, string]): Promise<string[] | null> {
      const current = ref.current;
      if (!current) return null;
      setBusy("Thinking of drills.");
      setError(null);
      const units = unitIds.map((id) => current.units.find((unit) => unit.id === id));
      const res = await fetch("/api/mercenary/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "suggest",
          place: NODES[current.location].name,
          ground: NODES[current.location].ground,
          units,
        }),
      });
      setBusy(null);
      if (!res.ok) {
        setError(await errorText(res));
        return null;
      }
      const data = (await res.json()) as { drills: string[] };
      return data.drills;
    },
    async sendElder(message: string) {
      const current = ref.current;
      if (!current || busy) return;
      setBusy("The elder is listening.");
      setError(null);
      const battles = current.units
        .flatMap((unit) => unit.battles.map((battle) => `${unit.name}, week ${battle.week}: ${battle.result} (${battle.deaths} lost)`))
        .join("\n");
      const res = await fetch("/api/mercenary/elder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: current.elderTalk,
          reputation: current.reputation,
          decisions: current.decisions,
          battles,
          deeds: current.villageDeeds,
          company: companyDescription(current),
        }),
      });
      if (!res.ok) {
        setError(await errorText(res));
        setBusy(null);
        return;
      }
      const data = (await res.json()) as { line?: string };
      if (!data.line?.trim()) {
        setError("The elder said nothing.");
        setBusy(null);
        return;
      }
      commit({
        ...current,
        elderTalk: [
          ...current.elderTalk,
          { role: "player", text: message.trim() },
          { role: "elder", text: data.line.trim() },
        ],
      });
      setBusy(null);
    },
    async takeWork() {
      const current = ref.current;
      if (!current) return;
      const result = acceptWork(current);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBusy("Word of the company is travelling.");
      const happened = result.state.decisions.at(-1)?.text ?? "Accepted the village's work.";
      const pulled = await pullReputation(result.state, happened);
      commit(pulled.state);
      setError(pulled.failed);
      setBusy(null);
    },
    async takeReward() {
      const current = ref.current;
      if (!current) return;
      const result = claimReward(current);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBusy("Word of the company is travelling.");
      const happened = result.state.decisions.at(-1)?.text ?? "Claimed the village reward.";
      const pulled = await pullReputation(result.state, happened);
      commit(pulled.state);
      setError(pulled.failed);
      setBusy(null);
    },
    async forageHere() {
      const current = ref.current;
      if (!current || busy) return;
      setBusy("They are out in the trees.");
      setError(null);
      const place = NODES[current.location];
      const men = headcount(current.units);
      let meals = fallbackForageMeals(men);
      let account = `They foraged in ${place.name} and brought back ${meals} rations.`;
      try {
        const res = await fetch("/api/mercenary/forest/forage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            men,
            place: place.name,
            ground: place.ground,
            bandits: current.bandits?.count ?? 0,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { meals?: number; account?: string };
          if (typeof data.meals === "number" && Number.isFinite(data.meals)) meals = data.meals;
          if (typeof data.account === "string" && data.account.trim()) account = data.account.trim();
        }
      } catch {
        /* The fallback ration roll already stands. */
      }
      await continueWeek(takeForestForage(current, meals, account));
    },
    fight() {
      const current = ref.current;
      if (!current) return;
      commit(openBattle(rememberLeader(current, "The company chose to fight."), "fight", null));
    },
    async retreat() {
      const current = ref.current;
      if (!current || busy) return;
      if (retreatStartsFight(Math.random())) {
        commit(openBattle(rememberLeader(current, "They tried to turn back and were caught."), "retreat", null));
        return;
      }
      setBusy("The week goes by.");
      await continueWeek(retreatQuiet(current));
    },
    async sneak() {
      const current = ref.current;
      if (!current || busy || !current.bandits) return;
      setBusy("Moving quietly.");
      setError(null);
      const detected = await fetch("/api/mercenary/forest/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bandits: banditDescription(current),
          company: companyDescription(current),
        }),
      });
      if (!detected.ok) {
        setError(await errorText(detected));
        setBusy(null);
        return;
      }
      const found = (await detected.json()) as { found: boolean; reason: string };
      if (!found.found) {
        await continueWeek(slipPast(current, found.reason || "They slipped past the band."));
        return;
      }
      setBusy("The bandit leader is deciding.");
      const leader = await fetch("/api/mercenary/forest/leader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerMen: headcount(current.units),
          banditMen: current.bandits.count,
          company: companyDescription(current),
          bandits: banditDescription(current),
          generalHistory: current.leader.generalHistory,
          withCompany: current.leader.withCompany,
        }),
      });
      if (!leader.ok) {
        setError(await errorText(leader));
        setBusy(null);
        return;
      }
      const decision = (await leader.json()) as { attack: boolean; reason: string };
      if (decision.attack) {
        commit(openBattle(rememberLeader(current, "He found them sneaking and chose to attack."), "leader", decision.reason));
        setBusy(null);
        return;
      }
      await continueWeek(slipPast(current, decision.reason || "He saw them and let them pass."));
    },
    async sendBattle(approach: string, supply: number) {
      const current = ref.current;
      if (!current || busy) return;
      const committed = commitApproach(current, approach, supply);
      if (!committed.ok) {
        setError(committed.error);
        return;
      }
      setBusy("The field is being judged.");
      setError(null);
      commit(committed.state);
      const res = await fetch("/api/mercenary/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: committed.state }),
      });
      if (!res.ok) {
        commit(refundApproach(committed.state));
        setError(await errorText(res));
        setBusy(null);
        return;
      }
      const data = (await res.json()) as { brief: string; chronicle: string; outcome: unknown };
      const validated = validateOutcome(committed.state, data.outcome);
      if (!validated.ok) {
        commit(refundApproach(committed.state));
        setError(validated.error);
        setBusy(null);
        return;
      }
      const applied = applyOutcome(committed.state, validated.value, data.brief, data.chronicle);
      const foe = committed.state.leader.name;
      const next = {
        ...applied.state,
        decisions: [...applied.state.decisions, { week: committed.state.week, text: `Fought ${foe}. ${data.brief}` }],
      };
      const shown = applied.result === "victory" ? { ...next, screen: "choice" as const } : { ...next, screen: "result" as const };
      commit(shown);
      setBusy(null);
      void refreshReputation(shown, `Fought ${foe}. ${data.brief}`);
      if (applied.result === "defeat" && shown.phase !== "wiped") await continueWeek(shown);
    },
    async choose(choice: Aftermath, names: string[]) {
      const current = ref.current;
      if (!current || busy) return;
      const result = applyAftermath(current, choice, names);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const happened = result.state.decisions.at(-1)?.text ?? "The company chose what to do with the survivors.";
      commit(result.state);
      void refreshReputation(result.state, happened);
      await continueWeek(result.state);
    },
    async hearContract() {
      const current = ref.current;
      if (!current || busy) return;
      const template = nextContractTemplate(current);
      if (!template) return;
      setBusy("Word of work is travelling.");
      setError(null);
      const place = NODES[template.place];
      let offer = "";
      try {
        const res = await fetch("/api/mercenary/contract/offer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: current.companyName,
            payer: template.payer,
            place: place.name,
            ground: place.ground,
            bandName: template.bandName,
            leaderName: template.leaderName,
            purse: template.purse,
            payAt: NODES[template.payAt].name,
            standing: current.reputation[template.payer],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { offer?: string };
          offer = data.offer?.trim() ?? "";
        }
      } catch {
        offer = "";
      }
      const offered = offerContract(ref.current ?? current, offer);
      if (!offered.ok) setError(offered.error);
      else commit(offered.state);
      setBusy(null);
    },
    takeOffer() {
      if (!ref.current) return;
      const result = takeContract(ref.current);
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        commit(result.state);
      }
    },
    rewardReady: state ? canClaimReward(state) : false,
  };
}
