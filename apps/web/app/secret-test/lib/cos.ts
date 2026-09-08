import Anthropic from "@anthropic-ai/sdk";
import { SEATS, STATES } from "../data/valden";
import type {
  CosRecommendation,
  CosTranslation,
  FactionId,
  SecretTestState,
} from "../types";
import { MAX_BRIEFING_WORDS } from "../types";
import { emptyTranslation } from "./state";
import { wordCount } from "./words";

const HAIKU = "claude-haiku-4-5";

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new Anthropic({ apiKey: key }) : null;
}

function mapDigest(state: SecretTestState): string {
  return state.seats
    .map((s) => {
      const def = SEATS.find((d) => d.id === s.id);
      return `${def?.name ?? s.id} (${def?.stateId}): lean ${s.lean.toFixed(2)} turnout ${Math.round(s.turnout * 100)}%`;
    })
    .join("\n");
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

  const api = client();
  if (!api) {
    return {
      executed: text.slice(0, 280),
      deferred: "",
      costKr: Math.min(180_000, cash),
      playerNote: "Logged as a single feasible package.",
      prioritiesForGm: text.slice(0, 400),
    };
  }

  const debate = pending?.debateAnswers?.length
    ? `\nDEBATE ANSWERS (pass through; do not rewrite):\n${pending.debateAnswers.map((a, i) => `Q${i + 1}: ${a}`).join("\n")}`
    : "";

  try {
    const response = await api.messages.create({
      model: HAIKU,
      max_tokens: 700,
      system: `You are the chief of staff for the ${faction} campaign in the Republic of Valden. The candidate is ${candidateName}.

Hard limits this month — be transparent:
- ONE package only: visit 1–2 ADJACENT constituencies, OR one speech/event, OR one paid-media buy in a named market, OR one fundraiser. Creative plans are allowed but you compress them to one package.
- They cannot visit 12 seats. They cannot buy the whole country.
- Cash on hand: kr ${cash.toLocaleString("en")}. If they cannot afford it, execute a cheaper feasible subset and apologise in playerNote.
- Cost honestly: visit ~kr 80–150k; grassroots in one seat ~kr 150–250k; local media ~kr 200–400k; national TV ~kr 500k+; fundraiser costs little and may raise money (GM decides the take).
- Issues they ignore stay unanswered. Do not invent a stance.

Return JSON only:
{"executed":"what actually happens","deferred":"what you refused or postponed","costKr":number,"playerNote":"short note back to the candidate","prioritiesForGm":"dense brief for the GM"}`,
      messages: [
        {
          role: "user",
          content: `MONTH ${state.month}/12. Issues: ${state.issues.join("; ") || "none"}
Last briefing:\n${state.briefings[faction] || "(opening)"}
Map:\n${mapDigest(state)}
DIRECTIVE:\n${text}${debate}`,
        },
      ],
    });
    const raw = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const obj = parseJsonObject(raw);
    if (!obj) return { ...fallback, prioritiesForGm: text.slice(0, 400), executed: text.slice(0, 280) };
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
    return { ...fallback, prioritiesForGm: text.slice(0, 400), executed: text.slice(0, 280) };
  }
}

export async function writeBriefing(
  state: SecretTestState,
  faction: FactionId,
  candidateName: string,
  opponentName: string,
  gmNote: string
): Promise<{ letter: string; opponentRumor: string; recommendations: CosRecommendation[] }> {
  const cash = state.cash[faction] ?? 0;
  const fallbackRecs: CosRecommendation[] = [
    { action: "Visit two adjacent seats", costKr: 120_000 },
    { action: "Local media in one state", costKr: 280_000 },
    { action: "Grassroots in one toss-up", costKr: 180_000 },
    { action: "Fundraiser in Havnstad", costKr: 20_000 },
  ];
  const fallbackLetter =
    `Month ${state.month}. Cash kr ${cash.toLocaleString("en")}. Issues: ${state.issues.join("; ") || "quiet"}. One package this month: two adjacent seats, or a speech, or a media buy, or a fundraiser. ${gmNote}`.slice(
      0,
      900
    );

  const api = client();
  if (!api) {
    return { letter: fallbackLetter, opponentRumor: "We think they still have a war chest.", recommendations: fallbackRecs };
  }

  try {
    const response = await api.messages.create({
      model: HAIKU,
      max_tokens: 800,
      system: `You are chief of staff for the ${faction} campaign. Candidate: ${candidateName}. Opponent: ${opponentName}.

Write a private briefing. Under ${MAX_BRIEFING_WORDS} words. Factual, direct, numbered where useful.
Must include: cash on hand; seats/demographics up and down; the national issues (ask them to opine if silent last time); ONE clear recommendation WITH a kr price; the monthly limit (one package: 1–2 adjacent visits OR speech OR media OR fundraiser).
Opponent: rumor only — never an exact pot. Spin what they did through your eyes.
If this is a debate month preview, say so.

Return JSON only:
{"letter":"...","opponentRumor":"one line","recommendations":[{"action":"...","costKr":number}]}`,
      messages: [
        {
          role: "user",
          content: `MONTH ${state.month}/12. Our cash: kr ${cash.toLocaleString("en")}
Issues: ${state.issues.join("; ")}
Debate questions queued: ${state.debateQuestions.join(" | ") || "none"}
Map:\n${mapDigest(state)}
States: ${STATES.map((s) => s.name).join(", ")}
GM NOTE:\n${gmNote}
Our last translation: ${JSON.stringify(state.lastTranslations[faction] ?? null)}`,
        },
      ],
    });
    const raw = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const obj = parseJsonObject(raw);
    if (!obj || typeof obj.letter !== "string") {
      return { letter: fallbackLetter, opponentRumor: "Unclear what they spent.", recommendations: fallbackRecs };
    }
    let letter = obj.letter;
    if (wordCount(letter) > MAX_BRIEFING_WORDS + 40) {
      letter = letter.split(/\s+/).slice(0, MAX_BRIEFING_WORDS).join(" ");
    }
    const recs = Array.isArray(obj.recommendations)
      ? obj.recommendations
          .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
          .map((r) => ({
            action: typeof r.action === "string" ? r.action : "Unnamed",
            costKr: typeof r.costKr === "number" ? Math.max(0, Math.round(r.costKr)) : 0,
          }))
          .slice(0, 4)
      : fallbackRecs;
    return {
      letter,
      opponentRumor: typeof obj.opponentRumor === "string" ? obj.opponentRumor : "They are still spending.",
      recommendations: recs.length ? recs : fallbackRecs,
    };
  } catch (err) {
    console.error("[secret-test/cos] brief failed", err);
    return { letter: fallbackLetter, opponentRumor: "No reliable read on their pot.", recommendations: fallbackRecs };
  }
}
