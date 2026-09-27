import { NODES } from "../data/map";
import type { GameState } from "./types";

export interface ForceGroup {
  id: string;
  name: string;
  count: number;
  lines: string;
}

export interface ForceCard {
  name: string;
  count: number;
  stance: string;
  description: string;
  groups: ForceGroup[];
}

export const BATTLER_SYSTEM =
  "You are not in this fight. Write what would happen if these forces fought. Do not advise. Do not address anyone. Finish every sentence.";

export const TRANSLATOR_SYSTEM =
  "Read the account and record what it did. Do not take a side. Do not add events that are not in the account.";

export const SUMMARIZER_SYSTEM =
  "Write one finished paragraph of what happened, so someone who was not there can hear it. Use only the account and the recorded result. Do not stop mid-sentence.";

export function fightSides(state: GameState, raid: boolean): { ground: string; a: ForceCard; b: ForceCard } {
  const band = state.bandits;
  const b: ForceCard = {
    name: band ? `${state.leader.name}'s band` : "The band",
    count: band?.count ?? 0,
    stance: band?.stance ?? "They watch.",
    description: band
      ? `${band.lines.join(" ")} Equipment: ${band.equipment?.length ? band.equipment.join(", ") : "what they carry"}. They hold ${band.coins ?? 0} coins and ${band.grain ?? 0} grain. ${(band.loot ?? []).slice(-3).join(" ")}`
      : "The band is gone.",
    groups: [{ id: "band", name: state.leader.name, count: band?.count ?? 0, lines: band?.lines.join(" ") ?? "" }],
  };
  const place = NODES[raid ? "millcross" : state.location];
  const ground = `${place.name}. ${place.ground}`;
  const village: ForceGroup = {
    id: "village",
    name: "Farmers at home",
    count: state.settlements.millcross.able,
    lines: "They have bills, forks, and a few spears.",
  };
  if (raid && state.location !== "millcross") {
    return {
      ground,
      a: {
        name: "The people of Millcross",
        count: village.count,
        stance: "They will stand in the lane with what they have.",
        description: "Farmers. Farm tools, not ranks. The common granary and the chest are behind them.",
        groups: [village],
      },
      b,
    };
  }
  const groups: ForceGroup[] = state.units
    .filter((unit) => unit.count > 0)
    .map((unit) => ({ id: unit.id, name: unit.name, count: unit.count, lines: unit.lines.join(" ") }));
  if (raid) groups.push(village);
  const men = groups.reduce((sum, group) => sum + group.count, 0);
  const approach = state.pendingBattle?.approach?.trim();
  return {
    ground,
    a: {
      name: state.companyName || "The armed company",
      count: men,
      stance: approach ? `${state.stance} They came on like this: ${approach}` : state.stance,
      description: `${state.condition} ${state.morale}`,
      groups,
    },
    b,
  };
}

export function battlerPrompt(ground: string, a: ForceCard, b: ForceCard): string {
  const side = (force: ForceCard, label: string) =>
    `${label}. ${force.name}. ${force.count} people.
Stance: ${force.stance}
${force.description}
${force.groups.map((group) => `- ${group.name} [${group.id}] ${group.count}. ${group.lines}`).join("\n")}`;
  return `Ground: ${ground}

${side(a, "Force A")}

${side(b, "Force B")}

If these forces, in these stances, fought on this ground, what would happen?`;
}

export function translatorPrompt(account: string, groups: ForceGroup[]): string {
  return `Account:
${account}

Groups, and the most each can lose:
${groups.map((group) => `- ${group.id}: ${group.name}, ${group.count}`).join("\n")}

Record what the account did.
holds is "a" if force A still has the ground, and "b" if force B does.
dead is how many each group lost.
grainToB and coinsToB are grain and coin that passed from force A to force B. Use 0 if the account moves none.
morale, stance, and condition are one sentence each about force B after the fight.
lines, if a group's way of fighting changed in the account, are the new sentences for that group id.`;
}

export function mentionsPlayer(text: string): boolean {
  return /\bplayer\b/i.test(text);
}
