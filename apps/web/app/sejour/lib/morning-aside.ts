import { GRAMMAR_BY_DAY } from "@/app/course/content/grammar";
import { BAKERY_ITEMS } from "../data/bakery";
import type { EventId, OutingId, PlaceId } from "../world/places";
import { isPlace } from "../world/places";

/** Same pastry all morning, a different one each day. */
export function bakeryErrandForDay(day: number): { fr: string; en: string } {
  const index = (Math.max(1, day) - 1) % BAKERY_ITEMS.length;
  const item = BAKERY_ITEMS[index] ?? BAKERY_ITEMS[0];
  return { fr: item.fr, en: item.en };
}

function dayNumber(context: string): number {
  const match = context.match(/\bDay\s+(\d+)/i);
  const day = match ? Number(match[1]) : 1;
  if (!Number.isFinite(day)) return 1;
  return Math.max(1, Math.min(28, day));
}

function firstName(name: string): string {
  const word = name.trim().split(/\s+/)[0] ?? "";
  return word || "them";
}

function placeLine(place: PlaceId, item: { fr: string; en: string }): string {
  switch (place) {
    case "boulangerie":
      return `the boulangerie, to pick up ${item.fr} (${item.en})`;
    case "epicerie":
      return "the épicerie, to shop for something to cook tonight";
    case "supermarche":
      return "the supermarché, to shop for the house";
    case "bistro":
      return "the bistro, for lunch";
    case "auberge":
      return "the auberge, for a meal";
    case "speedfriending":
      return "speed friending this evening, to meet people";
  }
}

const OUTING_LINE: Record<OutingId, string> = {
  parc: "the park",
  cinema: "the cinema",
  sport: "football",
};

/**
 * Private note on a morning turn. Talk first, then the day's errand.
 * Empty outside breakfast with Madame.
 */
export function hostMorningAside(input: {
  context: string;
  name: string;
  places: readonly PlaceId[];
  event?: EventId | null;
  invite?: { who: string; outing: OutingId } | null;
}): string {
  if (!/^MORNING\b/i.test(input.context.trim())) return "";

  const day = dayNumber(input.context);
  const who = firstName(input.name);
  const topic = GRAMMAR_BY_DAY[day]?.title?.trim() ?? "";
  const basics = topic
    ? `discussed some basics — ${topic}, or whatever this morning actually needs`
    : "discussed some basics";
  const opener = `Once you've made ${who} feel comfortable and ${basics}`;
  const item = bakeryErrandForDay(day);

  if (input.event === "family") {
    return `[Aside. Don't say this out loud.]\n${opener}, you should bring them to the lunch table. Camille has come from Dijon.`;
  }
  if (input.event === "sick") {
    return `[Aside. Don't say this out loud.]\n${opener}, you should tell them you're unwell and that you need something from the pharmacie.`;
  }

  const places = [...new Set(input.places.filter(isPlace))];
  const lines = places.map((place) => placeLine(place, item));
  if (input.invite) {
    const friend = input.invite.who.trim() || "a friend";
    lines.push(`meet ${friend} at ${OUTING_LINE[input.invite.outing]}`);
  }
  if (!lines.length) {
    lines.push(placeLine("boulangerie", item));
    places.push("boulangerie");
  }

  const onlyBakery = lines.length === 1 && places[0] === "boulangerie" && !input.invite;
  if (onlyBakery) {
    return `[Aside. Don't say this out loud.]\n${opener}, you should send them to the boulangerie to get something. Maybe ${item.fr} (${item.en}). When you send them, call suggest_place with boulangerie.`;
  }

  const numbered = lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
  const tool = places.length
    ? " When they choose a place, call suggest_place with it."
    : "";
  return `[Aside. Don't say this out loud.]\n${opener}, you should ask them what they want to do today. Maybe:\n${numbered}${tool}`;
}
