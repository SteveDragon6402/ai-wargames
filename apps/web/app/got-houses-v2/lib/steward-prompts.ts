import { factionLordId, stewardIdFor } from "../data/characters";
import { HOLDS_MAP } from "../data/holds";
import { armyMen } from "./forage";
import { blockingChoicesFor } from "./pending-choices";
import type { Faction, FactionOrders, GameState } from "../types";

export const STEWARD_RULE_TOPICS = [
  "move",
  "rest",
  "fortify",
  "speech",
  "lock",
  "turn",
  "walls",
  "siege",
  "forage",
  "talk",
  "victory",
] as const;

export type StewardRuleTopic = (typeof STEWARD_RULE_TOPICS)[number];

const RULES: Record<StewardRuleTopic, string> = {
  move: `How to march a host: click a hold on the map, then click the host in the right rail. Press March, then click an adjacent seat. A host may march one link per turn (1 link = 1 turn). There is no Attack order — if both sides end the turn at the same hold, they fight. You (the steward) cannot queue the march; the lord must click it.`,
  rest: `Rest: with a host selected, choose Rest. The host stays where it is and recovers condition. Rest spends the host's turn — it cannot also march.`,
  fortify: `Fortify: with a host selected, choose Fortify. The host digs in in the field at this seat. This is not garrisoning walls. Fortify spends the host's turn.`,
  speech: `Speech: with a host selected, address the men (once per host per turn). It spends that host's turn, like a march. The speech can imply rest or fortify. It is an order, not idle Talk.`,
  lock: `Lock orders: when the plan is set, press Lock in the top bar. Both sides must lock before the field is adjudicated. Unpaid seat-fates or prisoner choices block Lock — settle them first.`,
  turn: `How a turn works: 1. Inspect — click a hold, then a host. 2. Order — march, rest, fortify, speak, or work the walls. 3. Lock — both sides submit, then marches apply, fights are judged, and a new planning turn begins. You may Talk and split/merge during planning without spending a host's march.`,
  walls: `Walls: at a garrisonable seat you can Garrison men into the castle, Ungarrison them back to a host, Abandon, Conquer, or Liberate. Storm assaults the gates; Sally is the garrison riding out. Raze spends the host's turn tearing a seat down. Garrison peel is not a march.`,
  siege: `Siege: a field host of yours that is the sole faction at a hostile garrisonable seat invests it. Food days tick down. Fortify defends the siege camp, not the walls. Storm fights to take the gates. Parley opens Talk with the castellan. Yielding a seat is a terms decision, not something the steward can do.`,
  forage: `There is no gold. The land feeds the hosts. Country forage is picked over as armies graze on the march or in camp, and recovers slowly if left alone. Castles also have food days and supplies while invested. Darker/browner country on the Country map view means less forage left.`,
  talk: `Talk is the right-rail conversations with commanders, notables, and castellans. That is not this steward dock. Commanders remember counsel. The steward explains the board and recommends plays — he never marches a host or locks the turn.`,
  victory: `The North wins if Robb holds King's Landing or Casterly Rock for 3 turns, if the Westerlands are wiped, or if the war reaches turn 25. The Westerlands win if they hold Riverrun and the Twins plus 4 riverland seats, if the North is wiped, or if Robb dies.`,
};

const TOPIC_ALIASES: Record<string, StewardRuleTopic> = {
  march: "move",
  moving: "move",
  troops: "move",
  army: "move",
  host: "move",
  recover: "rest",
  dig: "fortify",
  digging: "fortify",
  submit: "lock",
  orders: "lock",
  planning: "turn",
  "how a turn works": "turn",
  garrison: "walls",
  storm: "walls",
  sally: "walls",
  raze: "walls",
  invest: "siege",
  food: "forage",
  supply: "forage",
  converse: "talk",
  council: "talk",
  win: "victory",
  winning: "victory",
};

export function explainRules(topic?: string): string {
  const available = STEWARD_RULE_TOPICS.join(", ");
  if (!topic || !topic.trim()) {
    return `Available topics: ${available}. Ask for one.`;
  }
  const raw = topic.trim().toLowerCase();
  const key = (STEWARD_RULE_TOPICS as readonly string[]).includes(raw)
    ? (raw as StewardRuleTopic)
    : TOPIC_ALIASES[raw];
  if (!key) {
    return `No handbook entry for "${topic}". Available topics: ${available}.`;
  }
  return RULES[key];
}

export interface StewardChip {
  id: string;
  label: string;
  intent: "chat" | "advice";
  text: string;
}

export function stewardRecommendedChips(
  state: GameState,
  faction: Faction
): StewardChip[] {
  const chips: StewardChip[] = [];
  if (state.turn <= 1) {
    chips.push({
      id: "turn",
      label: "How does a turn work?",
      intent: "chat",
      text: "How does a turn work?",
    });
  }
  chips.push(
    {
      id: "move",
      label: "How do I move a host?",
      intent: "chat",
      text: "How do I move a host?",
    },
    {
      id: "strength",
      label: "What is our strength?",
      intent: "chat",
      text: "What is the strength of my army?",
    },
    {
      id: "advice",
      label: "What should I do this turn?",
      intent: "advice",
      text: "What should I do this turn?",
    }
  );

  const lastBattles = (state.battleReports ?? []).filter(
    (r) => r.turn === state.turn - 1
  );
  if (lastBattles.length > 0) {
    chips.push({
      id: "fight",
      label: "What happened in that fight?",
      intent: "chat",
      text: "What happened in that fight last turn?",
    });
  }

  const choices = blockingChoicesFor(state.pendingChoices, faction);
  if (choices.length > 0) {
    chips.push({
      id: "fates",
      label: "What must I settle before I lock?",
      intent: "chat",
      text: "What must I settle before I lock?",
    });
  }

  const orders = faction === "north" ? state.north : state.westerlands;
  const unordered = state.armies.filter((a) => {
    if (a.faction !== faction) return false;
    if (orders.orders.some((o) => o.armyId === a.id)) return false;
    if (orders.stanceOrders[a.id]) return false;
    if (orders.stormArmyIds.includes(a.id)) return false;
    if ((orders.razeOrders ?? []).some((r) => r.armyId === a.id)) return false;
    return true;
  });
  if (unordered.length > 0 && state.phase === "planning") {
    chips.push({
      id: "unordered",
      label: "Which hosts have no orders yet?",
      intent: "chat",
      text: "Which hosts have no orders yet?",
    });
  }

  return chips;
}

export function formatStandingOrders(
  faction: Faction,
  orders: FactionOrders,
  state: Pick<GameState, "armies">
): string {
  const lines: string[] = [];
  const locked = orders.submitted ? "Orders are locked." : "Orders are not yet locked.";
  lines.push(`${faction === "north" ? "The North" : "The Westerlands"} — ${locked}`);

  if (orders.orders.length === 0) {
    lines.push("No marches queued.");
  } else {
    for (const o of orders.orders) {
      const army = state.armies.find((a) => a.id === o.armyId);
      const from = HOLDS_MAP.get(o.fromHoldId)?.name ?? o.fromHoldId;
      const to = HOLDS_MAP.get(o.toHoldId)?.name ?? o.toHoldId;
      lines.push(
        `March: ${army?.name ?? o.armyId} from ${from} to ${to}.`
      );
    }
  }

  for (const [armyId, stance] of Object.entries(orders.stanceOrders ?? {})) {
    const army = state.armies.find((a) => a.id === armyId);
    lines.push(`${stance === "rest" ? "Rest" : "Fortify"}: ${army?.name ?? armyId}.`);
  }
  for (const armyId of orders.stormArmyIds ?? []) {
    const army = state.armies.find((a) => a.id === armyId);
    lines.push(`Storm: ${army?.name ?? armyId}.`);
  }
  for (const holdId of orders.sallyHoldIds ?? []) {
    lines.push(`Sally: garrison at ${HOLDS_MAP.get(holdId)?.name ?? holdId}.`);
  }
  for (const raze of orders.razeOrders ?? []) {
    const army = state.armies.find((a) => a.id === raze.armyId);
    lines.push(
      `Raze: ${army?.name ?? raze.armyId} at ${HOLDS_MAP.get(raze.holdId)?.name ?? raze.holdId}.`
    );
  }
  return lines.join("\n");
}

export function buildStewardDigest(state: GameState, faction: Faction): string {
  const lord = state.characters[factionLordId(faction)]?.name ?? "my lord";
  const lines: string[] = [];
  lines.push(`Turn ${state.turn}. Address ${lord}.`);

  if (state.turn <= 1) {
    lines.push(
      "Opening of the campaign. Explain how a turn works, how to march (click hold, pick host, March, adjacent seat), and that both sides must Lock. Offer to answer questions. Do not pretend last-turn fighting happened."
    );
  } else {
    const reports = (state.battleReports ?? []).filter(
      (r) => r.turn === state.turn - 1
    );
    if (reports.length === 0) {
      lines.push("No battles last turn.");
    } else {
      lines.push("Battles last turn:");
      for (const r of reports) {
        const hold = HOLDS_MAP.get(r.holdId)?.name ?? r.holdId;
        lines.push(`- ${r.headline ?? r.shortSummary ?? `Fight at ${hold}`}`);
      }
    }

    const history = (state.turnHistory ?? []).find((h) => h.turn === state.turn - 1);
    const myMoves = (history?.armyMoves ?? []).filter((m) => m.faction === faction);
    if (myMoves.length === 0) {
      lines.push("Our hosts did not march last turn.");
    } else {
      lines.push("Our marches last turn:");
      for (const m of myMoves) {
        const from = HOLDS_MAP.get(m.fromHoldId)?.name ?? m.fromHoldId;
        const to = HOLDS_MAP.get(m.toHoldId)?.name ?? m.toHoldId;
        const verb = m.moved ? `marched ${from} to ${to}` : `${m.order} at ${from || to}`;
        lines.push(`- ${m.armyName}: ${verb}`);
      }
    }
  }

  const choices = blockingChoicesFor(state.pendingChoices, faction);
  if (choices.length > 0) {
    lines.push("Must be settled before Lock:");
    for (const c of choices) lines.push(`- ${c.headline}`);
  }

  const hosts = state.armies.filter((a) => a.faction === faction);
  lines.push("Hosts now:");
  if (hosts.length === 0) {
    lines.push("- None remain in the field.");
  } else {
    for (const a of hosts) {
      const hold = HOLDS_MAP.get(a.holdId)?.name ?? a.holdId;
      lines.push(`- ${a.name} at ${hold}, ~${armyMen(a).toLocaleString()} men`);
    }
  }

  return lines.join("\n");
}

export function buildStewardSystemPrompt(opts: {
  faction: Faction;
  intent: "brief" | "chat" | "advice";
  name: string;
  seedPrompt: string;
}): string {
  const lord =
    opts.faction === "north" ? "Robb Stark" : "Tywin Lannister";
  const intentLine =
    opts.intent === "brief"
      ? "Give a short briefing of what stands now (3–6 sentences). If this is turn 1, teach how a turn works and how to march."
      : opts.intent === "advice"
        ? "When asked what to do, look the board up with tools, then recommend 2–3 concrete plays (which host, from where, to where, or rest/fortify). Never queue the order yourself."
        : "Answer the question. Use tools for board facts. Use explain_rules for how the game or the clicks work.";

  return `You sit at the war table as steward — not a commander, not second-in-command.

You are ${opts.name}.
${opts.seedPrompt}

The player is ${lord}. Chrome on their screen says Steward. You may explain the interface in plain speech: which things they tap, that March is a button, that Lock submits the plan. Finish your sentences.

You MUST look up the board with tools before stating strength, location, last-turn fighting, or distances. Do not invent hosts or seats. For "how do I…" questions, call explain_rules. For standing marches this turn, call inspect_orders. Always pass fromHold to turns_to — you are not standing with a host.

You MUST NOT issue orders, lock the turn, accept terms, or pretend a march has been queued. If they say "move this host there," tell them how and why; they still click it.

Use tools privately, then call speak with the words you say aloud. That is the only line they hear. Aim for punchy speech (about 60–90 words); do not ramble.

SITUATION: ${intentLine}`;
}

export function stewardSpeakerName(
  state: Pick<GameState, "characters">,
  faction: Faction
): string {
  return state.characters[stewardIdFor(faction)]?.name ?? "Steward";
}

export function fallbackStewardBrief(turn: number, digest: string): string {
  if (turn <= 1) {
    return "The table is yours. Click a hold, pick a host, then March to an adjacent seat. When the plan is set, Lock. Ask me how the board works, or what we should do.";
  }
  const battles = digest
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .slice(0, 4)
    .map((l) => l.slice(2))
    .join(" ");
  if (battles) {
    return `From the last march: ${battles} The field is yours again — ask what stands, or what we should do.`;
  }
  return "The last march passed without a battle. Hosts are as they stand. Ask what we should do, or how the board works.";
}
