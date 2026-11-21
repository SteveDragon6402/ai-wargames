import { VOCAB_ITEMS } from "@/app/course/content/vocab";

/** The learner asked to stop, slow down, or said the last line didn't land. */
export function learnerIsLost(text: string): boolean {
  const line = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return (
    /\b(i don'?t understand|i do not understand|don'?t get it|didn'?t get that|what does that mean|what do you mean|too fast|go slower|slow down|say that again|say it again|i'?m lost|i am lost|i'?m confused|confused|lost me|come again|one more time)\b/.test(line) ||
    /\b(je ne comprends pas|je comprends pas|j'ai pas compris|plus lentement|plus doucement|repetez|repete|repeter|qu'est-ce que ca veut dire)\b/.test(line) ||
    /^\s*(pardon|excusez-moi|excuse-moi|quoi)\s*[?.!]?\s*$/.test(line.trim()) ||
    /^(huh|what|wait|hein)\b/.test(line.trim())
  );
}

export interface RepeatPhrase {
  fr: string;
  en: string;
}

function frenchBit(line: string): string {
  const clean = line.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const frenchy = /[àâäéèêëïîôùûüç]|\b(je|tu|il|elle|nous|vous|le|la|les|un|une|des|du|de|est|suis|ai|bonjour|ça|ca|ne|pas|et|à|au|aux|mon|ma|mes)\b/i;
  const chosen = sentences.find((sentence) => frenchy.test(sentence)) ?? sentences[0] ?? clean;
  return chosen.replace(/[«»"]/g, "").split(/\s+/).slice(0, 12).join(" ").trim();
}

function gloss(fr: string): string {
  const hay = fr.toLowerCase();
  const hit = [...VOCAB_ITEMS].sort((a, b) => b.fr.length - a.fr.length).find((item) => hay.includes(item.fr.toLowerCase()));
  return hit?.en ?? "";
}

/** The French line just before each "I don't understand". */
export function phrasesBeforeConfusion(lines: readonly { role: string; text: string }[]): RepeatPhrase[] {
  const found: RepeatPhrase[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.role !== "you" || !learnerIsLost(lines[i]?.text ?? "")) continue;
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j]?.role === "you") continue;
      const fr = frenchBit(lines[j]?.text ?? "");
      const key = fr.toLowerCase();
      if (fr && !seen.has(key)) {
        seen.add(key);
        found.push({ fr, en: gloss(fr) });
      }
      break;
    }
  }
  return found.slice(0, 6);
}

export function transcriptIsLost(lines: readonly { role: string; text: string }[]): boolean {
  return lines.some((line) => line.role === "you" && learnerIsLost(line.text));
}

export const STEP_BACK =
  "[PACE — THEY ARE LOST]: Stop the scene. Do not introduce anything new and do not move the story on. Take the last French you said, break it into one short piece, say what it means in English, and ask them to say that piece back. Stay on it until they do.";

export const STEADY_PACE =
  "[PACE]: One new idea per turn, in at most two short sentences. Wait for them. If they hesitate, give the English for that one piece and have them repeat it before you continue. Never stack a new grammar point on top of a word they have not said back.";
