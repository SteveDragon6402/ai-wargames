import type { EventId } from "./places";

export interface EventSpec {
  id: EventId;
  title: string;
  subtitle: string;
  portrait: string;
  scene: string;
  character: string;
  intro: string;
  minDay: number;
}

export const EVENT_SPECS: Record<EventId, EventSpec> = {
  family: {
    id: "family",
    title: "A visitor at the breakfast table",
    subtitle: "Someone has stopped by from Dijon to have lunch at the house.",
    portrait: "/sejour/v2/people/camille.jpg",
    scene: "/sejour/v2/scenes/dining.jpg",
    character: "camille",
    minDay: 17,
    intro:
      "There are two voices in the dining room this morning. A young woman in a yellow sweater is sitting at the table with a cup of coffee.",
  },
  sick: {
    id: "sick",
    title: "The kitchen is quiet this morning",
    subtitle: "A voice calls weakly from the top of the stairs.",
    portrait: "/sejour/v2/people/rousseau-sick.jpg",
    scene: "/sejour/v2/scenes/pharmacie.jpg",
    character: "rousseau",
    minDay: 24,
    intro:
      "The kettle is cold this morning. From upstairs, you hear coughing and a hoarse voice calling down the stairwell.",
  },
};

/** Select the next unlocked event that has not yet been played and whose day has arrived, or null. */
export function pendingEvent(
  unlocked: readonly string[],
  eventsDone: readonly string[],
  day = 99,
): EventId | null {
  if (unlocked.includes("event_family") && !eventsDone.includes("family") && day >= EVENT_SPECS.family.minDay) {
    return "family";
  }
  if (unlocked.includes("event_sick") && !eventsDone.includes("sick") && day >= EVENT_SPECS.sick.minDay) {
    return "sick";
  }
  return null;
}
