import { MAX_ACTION_CHARS, MAX_ACTION_WORDS, MAX_DEBATE_WORDS } from "../types";

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function validateActionText(text: string): string | null {
  if (!text.trim()) return "Write this month's directives.";
  if (text.length > MAX_ACTION_CHARS) {
    return `Directives must be under ${MAX_ACTION_CHARS} characters.`;
  }
  const words = wordCount(text);
  if (words > MAX_ACTION_WORDS) {
    return `Directives must be ${MAX_ACTION_WORDS} words or fewer (${words} written).`;
  }
  return null;
}

export function validateDebateAnswers(answers: unknown, expected: number): string | null {
  if (expected === 0) return null;
  if (!Array.isArray(answers) || answers.length !== expected) {
    return `Answer all ${expected} debate questions.`;
  }
  for (let i = 0; i < answers.length; i++) {
    const a = typeof answers[i] === "string" ? answers[i].trim() : "";
    if (!a) return `Question ${i + 1} is blank.`;
    if (wordCount(a) > MAX_DEBATE_WORDS) {
      return `Question ${i + 1} must be ${MAX_DEBATE_WORDS} words or fewer.`;
    }
  }
  return null;
}
