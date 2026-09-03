import { MAX_ACTION_CHARS, MAX_ACTION_WORDS } from "../types";

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function validateActionText(text: string): string | null {
  if (!text.trim()) return "Write your orders before you seal them.";
  if (text.length > MAX_ACTION_CHARS) {
    return `Orders must be under ${MAX_ACTION_CHARS} characters.`;
  }
  const words = wordCount(text);
  if (words > MAX_ACTION_WORDS) {
    return `Orders must be ${MAX_ACTION_WORDS} words or fewer (${words} written).`;
  }
  return null;
}
