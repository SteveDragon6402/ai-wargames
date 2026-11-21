import type { GrammarLesson, LearnerFact } from "@/app/course/types";

function factValue(facts: Record<string, LearnerFact> | undefined, keys: string[]): string {
  if (!facts) return "";
  for (const key of keys) {
    const value = facts[key]?.value?.trim();
    if (value) return value;
  }
  return "";
}

/**
 * Fill the slots a lesson left open. The name comes from the stay.
 * A place only fills "je suis …" when the conversation already stored it in French (de / du / d').
 * Otherwise the taught word prêt is used, so the answer is never a word the lesson did not say.
 */
export function fillGrammarLesson(lesson: GrammarLesson, facts?: Record<string, LearnerFact>): GrammarLesson {
  const name = factValue(facts, ["name"]) || "Alex";
  const origin = factValue(facts, ["from", "origin", "hometown", "country"]);
  const state = /^(de |du |d'|des )/i.test(origin) ? origin : "prêt";
  const stateEn = state === "prêt" ? "ready" : origin;
  const slots: Record<string, string> = {
    name,
    state,
    stateEn,
    host: "Madame Rousseau",
  };
  const fill = (value: string) => value.replace(/\{\{(name|state|stateEn|host)\}\}/g, (_, key: string) => slots[key] ?? "");
  const filled = JSON.parse(JSON.stringify(lesson), (_key, value) => (typeof value === "string" ? fill(value) : value)) as GrammarLesson;
  if (state === "prêt") {
    for (const exercise of filled.exercises) {
      if (exercise.answer === "Bonjour Madame, je suis prêt.") {
        exercise.accept = [...(exercise.accept ?? []), "Bonjour Madame, je suis prête."];
      }
    }
  }
  return filled;
}
