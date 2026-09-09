import Anthropic from "@anthropic-ai/sdk";
import { COUNTRY_RULES } from "../data/valden";
import type {
  CosRecommendation,
  CosTranslation,
  FactionId,
  SecretTestState,
} from "../types";
import {
  LLM_TIMEOUT_MS,
  MAX_BRIEFING_WORDS,
  MAX_OPENING_BRIEFING_WORDS,
} from "../types";
import { rivalFaction } from "../types";
import { colorWord, templateBriefing } from "./desk";
import { formatKr, humanMapDigest } from "./lean";
import { emptyTranslation } from "./state";
import { withTimeoutFallback } from "./timeout";
import { wordCount } from "./words";

const HAIKU = "claude-haiku-4-5";

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new Anthropic({ apiKey: key, timeout: LLM_TIMEOUT_MS, maxRetries: 0 }) : null;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clipLetter(letter: string, cap: number): string {
  if (wordCount(letter) <= cap + 20) return letter.trim();
  const parts = letter.trim().split(/\n{2,}/);
  let out = "";
  for (const part of parts) {
    const next = out ? `${out}\n\n${part}` : part;
    if (wordCount(next) > cap) break;
    out = next;
  }
  return out || letter.split(/\s+/).slice(0, cap).join(" ");
}

export async function translateDirective(
  state: SecretTestState,
  faction: FactionId,
  candidateName: string
): Promise<CosTranslation> {
  const pending = state.pendingActions[faction];
  const text = pending?.text?.trim() ?? "";
  const cash = state.cash[faction] ?? 0;
  const fallback = emptyTranslation();
  if (!text) return fallback;

  const cheapFallback: CosTranslation = {
    executed: text.slice(0, 280),
    deferred: "",
    costKr: Math.min(180_000, cash),
    playerNote: "Logged as one feasible package.",
    prioritiesForGm: text.slice(0, 400),
  };

  const api = client();
  if (!api) return cheapFallback;

  const debate = pending?.debateAnswers?.length
    ? `\nDEBATE ANSWERS (pass through unchanged):\n${pending.debateAnswers.map((a, i) => `Q${i + 1}: ${a}`).join("\n")}`
    : "";

  const other = rivalFaction(faction);
  const work = api.messages.create({
    model: HAIKU,
    max_tokens: 500,
    system: `You are chief of staff to ${candidateName}, the ${colorWord(faction)} candidate for president of Valden. The opponent is the ${colorWord(other)} ticket. You speak to the candidate like a sharp deputy — short, human, no theatre.

This month you may execute ONE package:
- visit 1–2 neighbouring constituencies, OR
- one speech/event, OR
- one paid-media buy in a named market, OR
- one fundraiser.
Creative plans are allowed. You compress them. If they cannot afford it, execute a cheaper feasible subset and apologise in playerNote like a person: "We could not buy national TV. We booked local radio in Lysfjord instead."

Cash on hand: ${formatKr(cash)}.
Honest costs: visit kr 80–150k; grassroots one seat kr 150–250k; local media kr 200–400k; national TV kr 500k+; fundraiser costs little.
Issues they ignore stay unanswered. Do not invent a stance.
You are ${colorWord(faction)}. Never describe this campaign as ${colorWord(other)}.

Return JSON only:
{"executed":"what actually happens this month","deferred":"what you refused","costKr":number,"playerNote":"2–4 sentences to the candidate, spoken aloud","prioritiesForGm":"dense factual brief for the GM"}`,
    messages: [
      {
        role: "user",
        content: `MONTH ${state.month}/12
${humanMapDigest(state, faction)}
Issues: ${state.issues.join("; ") || "none"}
Last briefing:\n${state.briefings[faction] || "(opening)"}
DIRECTIVE:\n${text}${debate}`,
      },
    ],
  });

  try {
    const response = await withTimeoutFallback(work, LLM_TIMEOUT_MS, "cos-translate", null);
    if (!response) return cheapFallback;
    const raw = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const obj = parseJsonObject(raw);
    if (!obj) return { ...cheapFallback, prioritiesForGm: text.slice(0, 400) };
    let costKr = typeof obj.costKr === "number" ? Math.max(0, Math.round(obj.costKr)) : 0;
    if (costKr > cash) costKr = cash;
    return {
      executed: typeof obj.executed === "string" ? obj.executed : fallback.executed,
      deferred: typeof obj.deferred === "string" ? obj.deferred : "",
      costKr,
      playerNote: typeof obj.playerNote === "string" ? obj.playerNote : "",
      prioritiesForGm: typeof obj.prioritiesForGm === "string" ? obj.prioritiesForGm : text.slice(0, 400),
    };
  } catch (err) {
    console.error("[secret-test/cos] translate failed", err);
    return cheapFallback;
  }
}

export async function writeBriefing(
  state: SecretTestState,
  faction: FactionId,
  candidateName: string,
  opponentName: string,
  gmNote: string
): Promise<{ letter: string; opponentRumor: string; recommendations: CosRecommendation[] }> {
  const fallback = templateBriefing(state, faction, candidateName, opponentName, gmNote);
  const opening = state.history.length === 0;
  const cap = opening ? MAX_OPENING_BRIEFING_WORDS : MAX_BRIEFING_WORDS;
  const cash = state.cash[faction] ?? 0;
  const other = rivalFaction(faction);

  const api = client();
  if (!api) return fallback;

  const shape = opening
    ? `OPENING DESK NOTE — first time this candidate has sat down with you.
Follow this shape. Short sentences. Speak to a senior person who will skim.

YOU ARE THE ${colorWord(faction)} CAMPAIGN.
One line: their name, the opponent's name, ${colorWord(other)} is the other colour. Map colours are campaign colours. The other colour is not them.

HOW THIS IS WON
Four or five sentences from the country rules. No lore dump.

MONEY
Exact cash. One-package rule.

THE BOARD
State by state in us/them language. No lean decimals.

LIVE ISSUES
Bullet the issues. Say: if they do not take a line in the 300 words, we stay mute.

THIS MONTH
One recommended package with a kr price and why, one sentence.`
    : `MONTHLY DESK NOTE — they already know the rules.
YOU ARE STILL THE ${colorWord(faction)} CAMPAIGN. Opponent name + colour.
MONEY — one line.
THE BOARD — only what moved or is still in play. Us/them. No 17-seat list unless something flipped.
WHAT JUST HAPPENED — two or three facts from the GM note, through our eyes. Opponent as rumour, never an exact pot.
LIVE ISSUES — bullets. Silence = no stance.
DEBATE — only if questions are queued.
THIS MONTH — one ask, with a price.`;

  const work = api.messages.create({
    model: HAIKU,
    max_tokens: opening ? 900 : 650,
    system: `You are the chief of staff for ${candidateName}, the ${colorWord(faction)} presidential candidate in Valden. Opponent: ${opponentName} (${colorWord(other)}).

Write as if you are in the room with a busy principal. Clear. Concise. Human. No "as your chief of staff". No numbered 12-item dumps. No decimal lean scores. Surface only what they must know to decide this month.

You MUST open the letter with: "YOU ARE THE ${colorWord(faction)} CAMPAIGN."
Never tell them they are ${colorWord(other)}. Never let "red" mean "the reader".

Word cap: ${cap}. Prefer fewer.

${shape}

Country rules (use only what you need):
${COUNTRY_RULES}

Return JSON only:
{"letter":"...","opponentRumor":"one human sentence, no exact pot","recommendations":[{"action":"...","costKr":number}]}`,
    messages: [
      {
        role: "user",
        content: `MONTH ${state.month}/12. Our cash: ${formatKr(cash)}
Candidate: ${candidateName} (${colorWord(faction)}). Opponent: ${opponentName} (${colorWord(other)}).
Issues: ${state.issues.join(" | ") || "none"}
Debate questions queued: ${state.debateQuestions.join(" | ") || "none"}
THE BOARD (us/them from OUR desk):
${humanMapDigest(state, faction)}
GM NOTE (facts, interpret for us):
${gmNote || "(quiet)"}
Last package we ran: ${state.lastTranslations[faction]?.executed ?? "none yet"}`,
      },
    ],
  });

  try {
    const response = await withTimeoutFallback(work, LLM_TIMEOUT_MS, "cos-brief", null);
    if (!response) return fallback;
    const raw = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const obj = parseJsonObject(raw);
    if (!obj || typeof obj.letter !== "string") return fallback;
    let letter = clipLetter(obj.letter, cap);
    const must = `YOU ARE THE ${colorWord(faction)} CAMPAIGN`;
    if (!letter.toUpperCase().includes(must)) {
      letter = `${must}.\n\n${letter}`;
    }
    const recs = Array.isArray(obj.recommendations)
      ? obj.recommendations
          .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
          .map((r) => ({
            action: typeof r.action === "string" ? r.action : "Unnamed",
            costKr: typeof r.costKr === "number" ? Math.max(0, Math.round(r.costKr)) : 0,
          }))
          .slice(0, 4)
      : fallback.recommendations;
    return {
      letter,
      opponentRumor:
        typeof obj.opponentRumor === "string" ? obj.opponentRumor : fallback.opponentRumor,
      recommendations: recs.length ? recs : fallback.recommendations,
    };
  } catch (err) {
    console.error("[secret-test/cos] brief failed", err);
    return fallback;
  }
}
