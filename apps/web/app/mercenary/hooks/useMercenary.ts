"use client";

import { useEffect, useRef, useState } from "react";
import {
  acceptWork,
  applyAftermath,
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
  dequeue,
  enqueue,
  finishWeek,
  freshGame,
  headcount,
  nameStartingUnits,
  openBattle,
  refundApproach,
  rememberLeader,
  retreatQuiet,
  retreatStartsFight,
  setCompanyName,
  setRation,
  setStance,
  slipPast,
  stepQueue,
  validateOutcome,
} from "../lib/engine";
import type { BaseTypeId } from "../data/wiki";
import { REPUTATION_KEYS, type Aftermath, type GameState, type WeekAction } from "../lib/types";

const KEY = "mercenary-band-v1";

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
        if (parsed.version === 1) {
          ref.current = parsed;
          setState(parsed);
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

  async function continueWeek(start: GameState) {
    let current = start.resolveIndex === 0 ? beginResolution(start) : start;
    while (true) {
      const step = stepQueue(current);
      if (step.kind === "forest") {
        commit(step.state);
        setBusy(null);
        return;
      }
      if (step.kind === "train") {
        setBusy("The drill is being written down.");
        const units = step.unitIds.map((id) => current.units.find((unit) => unit.id === id));
        const res = await fetch("/api/mercenary/train", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "apply", drill: step.drill, units }),
        });
        if (!res.ok) {
          commit(current);
          setError(await errorText(res));
          setBusy(null);
          return;
        }
        const data = (await res.json()) as { lines: Record<string, [string, string, string]> };
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
        commit(finishWeek(step.state));
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
    stance(value: string) {
      if (!ref.current) return;
      commit(setStance(ref.current, value));
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
        body: JSON.stringify({ mode: "suggest", units }),
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
      let next = {
        ...applied.state,
        decisions: [...applied.state.decisions, { week: committed.state.week, text: `Fought the Blackwood bandits. ${data.brief}` }],
      };
      if (applied.result === "defeat") next = finishWeek(next);
      setBusy("Word of the company is travelling.");
      const pulled = await pullReputation(next, `Fought the Blackwood bandits. ${data.brief}`);
      commit(applied.result === "victory" ? { ...pulled.state, screen: "choice" } : pulled.state);
      setError(pulled.failed);
      setBusy(null);
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
      const closed = finishWeek(result.state);
      setBusy("Word of the company is travelling.");
      const pulled = await pullReputation(closed, happened);
      commit(pulled.state);
      setError(pulled.failed);
      setBusy(null);
    },
    rewardReady: state ? canClaimReward(state) : false,
  };
}
