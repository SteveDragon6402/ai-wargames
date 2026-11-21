import type { EventId, SceneId, UnlockId } from "./places";
import { SKILLS, type Ratings, type Skill } from "./skills";
import { TUNING } from "./tuning";

export interface Assessment {
  scene: SceneId;
  day: number;
  ratings: Ratings;
}

/** The slice of the save the gates read. */
export interface Progress {
  assessments: Assessment[];
  visits: Partial<Record<string, number>>;
  eventsDone: string[];
  teacherUnlocked?: readonly UnlockId[];
}

type Rule = (progress: Progress) => boolean;

export function rated(skill: Skill, min: number, times: number, scene?: SceneId): Rule {
  return (progress) => progress.assessments.filter((item) => (!scene || item.scene === scene) && (item.ratings[skill] ?? -1) >= min).length >= times;
}

export function visits(place: string, times: number): Rule {
  return (progress) => (progress.visits[place] ?? 0) >= times;
}

export function convos(count: number): Rule {
  return (progress) => progress.assessments.filter((item) => Object.keys(item.ratings).length > 0).length >= count;
}

/** Mean of every score in the latest window of rated conversations. */
export function averageScore(progress: Progress): number {
  const recent = progress.assessments.filter((item) => Object.keys(item.ratings).length > 0).slice(-TUNING.averageWindow);
  const scores = recent.flatMap((item) => Object.values(item.ratings).filter((value): value is number => typeof value === "number"));
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
}

export function average(min: number): Rule {
  return (progress) => averageScore(progress) >= min;
}

export function eventDone(id: EventId): Rule {
  return (progress) => progress.eventsDone.includes(id);
}

export function all(...rules: Rule[]): Rule {
  return (progress) => rules.every((rule) => rule(progress));
}

export interface Gate {
  id: string;
  label: string;
  when: Rule;
  unlocks: UnlockId[];
}

const T = TUNING;

export const GATES: Gate[] = [
  { id: "intro", label: "You can introduce yourself", when: rated(T.intro.skill, T.intro.min, T.intro.times), unlocks: ["boulangerie"] },
  { id: "bread", label: "You can order bread", when: rated(T.bread.skill, T.bread.min, T.bread.times, T.bread.scene), unlocks: ["epicerie", "speedfriending"] },
  { id: "bistro", label: "You can shop at the grocer", when: visits("epicerie", T.bistroAfterShops), unlocks: ["bistro"] },
  { id: "formal", label: "Your manners are ready for L'Auberge", when: all(visits("bistro", T.formal.visits), rated(T.formal.skill, T.formal.min, T.formal.times)), unlocks: ["auberge"] },
  { id: "supermarche", label: "You are ready for the big supermarket", when: all(visits("epicerie", T.supermarche.epicerieVisits), convos(T.supermarche.convos)), unlocks: ["supermarche"] },
  { id: "friends", label: "You can make friends in French", when: rated(T.friends.skill, T.friends.min, T.friends.times, T.friends.scene), unlocks: ["invite_parc", "invite_cinema", "invite_sport"] },
  { id: "ev_family", label: "Madame's family is visiting", when: all(convos(T.family.convos), average(T.family.average)), unlocks: ["event_family"] },
  { id: "ev_sick", label: "Madame needs you", when: all(convos(T.sick.convos), average(T.sick.average), eventDone("family")), unlocks: ["event_sick"] },
];

export const GATE_BY_ID: Record<string, Gate> = Object.fromEntries(GATES.map((gate) => [gate.id, gate]));

/** Gates passed and everything they open. Pure: same progress, same answer. */
export function evaluate(progress: Progress): { gates: string[]; unlocked: UnlockId[] } {
  const gates: string[] = [];
  const unlocked: UnlockId[] = [];
  if (progress.teacherUnlocked) {
    for (const id of progress.teacherUnlocked) {
      if (!unlocked.includes(id)) unlocked.push(id);
    }
  }
  for (const gate of GATES) {
    if (!gate.when(progress)) continue;
    gates.push(gate.id);
    for (const id of gate.unlocks) if (!unlocked.includes(id)) unlocked.push(id);
  }
  return { gates, unlocked };
}

/** Gates that are newly passed compared with what the player has already been told about. */
export function newlyPassed(progress: Progress, known: readonly string[]): Gate[] {
  const { gates } = evaluate(progress);
  return gates.filter((id) => !known.includes(id)).map((id) => GATE_BY_ID[id]);
}

/** Mean per skill over recent assessments; skills never rated are left out. */
export function skillProfile(progress: Progress, window = 10): Partial<Record<Skill, number>> {
  const recent = progress.assessments.slice(-window);
  const out: Partial<Record<Skill, number>> = {};
  for (const skill of SKILLS) {
    const scores = recent.map((item) => item.ratings[skill]).filter((value): value is number => typeof value === "number");
    if (scores.length) out[skill] = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  }
  return out;
}

/** The weakest skills first, among those rated. */
export function weakestSkills(progress: Progress): Skill[] {
  const profile = skillProfile(progress);
  return (Object.entries(profile) as [Skill, number][]).sort((a, b) => a[1] - b[1]).map(([skill]) => skill);
}
