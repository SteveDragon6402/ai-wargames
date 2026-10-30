import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../mercenary/model";
import { ITEM_BY_ID } from "@/app/epicerie/data/items";
import { GESTURES, isGesture } from "@/app/epicerie/lib/gerard";
import { labelForLine, phrasesBuriedIn, reviewProse, type LineLabel } from "@/app/epicerie/lib/french";

export const maxDuration = 60;

interface Body {
  lines?: { role?: string; text?: string; pointed?: string; gesture?: string }[];
  scene?: string;
}

const SAID = ["Understood", "Close", "English", "Unclear", "French"] as const;

const TOOL: Anthropic.Tool = {
  name: "debrief",
  description: "Record the review of the whole visit.",
  input_schema: {
    type: "object",
    properties: {
      glosses: {
        type: "array",
        description: "One entry per shopkeeper line, using the index given.",
        items: {
          type: "object",
          properties: { index: { type: "integer" }, en: { type: "string" } },
          required: ["index", "en"],
        },
      },
      yours: {
        type: "array",
        description: "One entry per customer line, using the index given.",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            said: {
              type: "string",
              enum: [...SAID],
              description:
                "Understood if the French moved the shopping along. French if the words are French, including swearing. Close if almost French. English only if the words are English. Unclear if the language cannot be told.",
            },
            note: { type: "string", description: "One or two sentences. If the line was abrupt or incomplete, quote the fuller French they could say next time." },
            en: { type: "string", description: "A plain English translation of this player line. If it was already English, say what it meant and give no second French version here." },
          },
          required: ["index", "said", "note", "en"],
        },
      },
      analysis: {
        type: "string",
        description: "Four to six sentences on this visit: what the customer said, what was right, what was wrong, what to remember.",
      },
      phrases: {
        type: "array",
        description: "Three to six short reusable French phrases from this visit.",
        items: {
          type: "object",
          properties: { fr: { type: "string" }, en: { type: "string" } },
          required: ["fr", "en"],
        },
      },
      tip: { type: "string", description: "One concrete sentence for the next visit, in English." },
      gaps: {
        type: "array",
        description: "Handout ids this scene showed they still need. Ids: je, articles, voudrais, negation, questions, please, etre, vous, verbs.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ["je", "articles", "voudrais", "negation", "questions", "please", "etre", "vous", "verbs"] },
            note: { type: "string" },
          },
          required: ["id", "note"],
        },
      },
      mastered: {
        type: "array",
        description: "Handout ids they handled correctly this scene. Do not include a phrase they only attempted.",
        items: { type: "string", enum: ["je", "articles", "voudrais", "negation", "questions", "please", "etre", "vous", "verbs"] },
      },
    },
    required: ["glosses", "yours", "analysis", "phrases", "tip"],
  },
};

const ADDRESS =
  "Vous is for Gérard, Madame Rousseau, waiters, the conductor and anyone older. Never tell the player to use tu with Gérard because he was friendly. Tu is only for a young person at speed friending who already used tu. If they used tu where vous was needed, the note says to use vous, and gaps includes id vous. en on every yours entry is the English of the player's own line. gaps lists handout ids this scene showed they need. mastered lists ids they handled. Use only: je, articles, voudrais, negation, questions, please, etre, vous, verbs.";

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as T[];
  if (typeof value === "string") {
    try {
      return asArray<T>(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

type RawDebrief = { glosses?: unknown; yours?: unknown; phrases?: unknown; tip?: unknown; analysis?: unknown; gaps?: unknown; mastered?: unknown };

/** The model sometimes packs the whole answer, as JSON text, into one field. */
function unwrap(value: unknown): RawDebrief {
  const input = (value && typeof value === "object" ? value : {}) as RawDebrief;
  for (const field of [input.glosses, input.phrases]) {
    if (typeof field !== "string") continue;
    try {
      const parsed = JSON.parse(field) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && ("glosses" in parsed || "phrases" in parsed || "yours" in parsed)) {
        return { ...input, ...(parsed as RawDebrief) };
      }
    } catch {
      continue;
    }
  }
  return input;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });
  const body = (await req.json().catch(() => null)) as Body | null;
  const scene = body?.scene === "friends" || body?.scene === "restaurant" || body?.scene === "postcard" || body?.scene === "station" ? body.scene : "shop";
  const lines = (Array.isArray(body?.lines) ? body.lines : [])
    .map((line, index) => ({
      index,
      role: line?.role === "gerard" ? "gerard" : line?.role === "event" ? "event" : "you",
      text: typeof line?.text === "string" ? line.text.slice(0, 400) : "",
      pointed: typeof line?.pointed === "string" && ITEM_BY_ID[line.pointed] ? ITEM_BY_ID[line.pointed].en : "",
      gesture: isGesture(line?.gesture) ? GESTURES[line.gesture] : "",
    }))
    .filter((line) => line.text.trim() || line.pointed || line.gesture)
    .slice(-60);
  if (!lines.some((line) => line.role === "gerard")) {
    return NextResponse.json({ glosses: [], yours: [], phrases: [], tip: "", analysis: "", gaps: [], mastered: [] });
  }

  const script = lines
    .map((line) => {
      if (line.role === "event") return `(${line.text})`;
      const doing = [line.pointed ? `pointing at ${line.pointed}` : "", line.gesture].filter(Boolean).join(", ");
      const said = line.text.trim();
      const bodyText = [doing ? `(${doing})` : "", said].filter(Boolean).join(" ");
      const who = line.role === "gerard" ? (scene === "friends" ? "Villager" : scene === "restaurant" ? "Waiter" : scene === "postcard" ? "Note" : scene === "station" ? "Conductor" : "Shopkeeper") : scene === "station" ? "You" : "Customer";
      return `[${line.index}] ${who}: ${bodyText}`;
    })
    .join("\n");

  const handoutIds = new Set(["je", "articles", "voudrais", "negation", "questions", "please", "etre", "vous", "verbs"]);
  let review: {
    glosses: { index: number; en: string }[];
    yours: { index: number; said: LineLabel; note: string; en: string }[];
    phrases: { fr: string; en: string }[];
    tip: string;
    analysis: string;
    gaps: { id: string; note: string }[];
    mastered: string[];
  } | null = null;
  const customerLines = lines.filter((line) => line.role === "you").length;
  for (let attempt = 0; attempt < 2 && (!review?.glosses.length || (customerLines > 0 && !review.yours.length)); attempt++) {
    const response = await createMessage(client, {
      max_tokens: 2500,
      system: scene === "shop"
        ? `You review one visit to a French village shop. The customer was trying to buy things. Gérard the shopkeeper speaks French and almost no English. Cover both sides of the conversation, using the actual words.

Call debrief with:
- glosses: for every shopkeeper line, the index and a natural English translation that keeps his mood.
- yours: for every customer line, the index, a said label, and a note of one or two sentences. Understood means French that moved the shopping along. French means the words are French but did not ask for anything: swearing and insults count, and merde and putain are French, never English. Close means it was almost French: quote what they said and the French that would have landed. English means the words are English: say so and give the short French they needed. Unclear means you cannot tell the language. Say what Gérard did with it.
- analysis: four to six sentences of plain prose about this visit only. What the customer said, what was right, what was wrong, what is worth remembering. Name the words. No tags, no JSON, no parameter markup inside it.
- phrases: three to six short reusable French phrases from this visit, each with English.
- tip: one concrete sentence for the next visit.

Do not praise them for showing up. Do not be vague. If a line was too short or abrupt, the note must quote a fuller French line that adds one word or one piece of grammar to what they already said. Glosses, yours and phrases are JSON arrays. ${ADDRESS}`
        : scene === "station"
        ? `You review a conversation at a French branch-line station. Write to the traveller as "you". Never call them a customer. Never mention buying, a ticket, a shop, a till, or Gérard. The other person is the conductor or the officer.

Call debrief with:
- glosses: for every conductor line, the index and a natural English translation.
- yours: for every "You" line, the index, a said label, and a note of one sentence. If the line was abrupt, the note quotes one fuller French question, such as "Quel train va à la gare du marché ?" Do not offer a second wording of that question.
- analysis: two sentences, second person. What you said, then what they told you to do, including the platform and the minutes if they gave them.
- phrases: three short French lines for a station, each with English. One asks which train goes to a place.
- tip: that same fuller French question, once, with its English. Do not repeat the analysis.

Do not praise them for showing up. Glosses, yours and phrases are JSON arrays. ${ADDRESS}`
        : scene === "postcard"
        ? `You review a postcard the guest wrote. The Note line is the box accepting the card, not a shopkeeper, and nobody is buying anything. Do not mention a shop, a till, or Gérard. Translate the note. If the message is English, say so and offer two short French lines they could have written to their mother. Analysis is three or four sentences. Phrases are three short French lines for a postcard, with English. Tip is one sentence. Glosses, yours and phrases are JSON arrays. ${ADDRESS}`
        : `You review one conversation in a French village. ${scene === "friends" ? "It was speed friending. The other person is a villager, not a shopkeeper, and nobody is buying anything." : "The guest was ordering a meal. The other person is the waiter, not a shopkeeper."} Do not mention a shop, a till, or Gérard. Cover both sides, using the actual words.

Call debrief with:
- glosses: for every ${scene === "friends" ? "villager" : "waiter"} line, the index and a natural English translation that keeps their mood.
- yours: for every customer line, the index, a said label, and a note of one or two sentences. Understood means French that ${scene === "friends" ? "kept the conversation going" : "ordered, asked the price, or paid"}. French means the words are French but did not do that: swearing and insults count, and merde and putain are French, never English. Close means it was almost French: quote what they said and the French that would have landed. English means the words are English: say so and give the short French they needed. Unclear means you cannot tell the language. Say what the other person did with it.
- analysis: four to six sentences of plain prose about this conversation only. What the guest said, what was right, what was wrong, what is worth remembering. Name the words. No tags, no JSON, no parameter markup inside it.
- phrases: three to six short reusable French phrases from this conversation, each with English.
- tip: one concrete sentence for the next time.

Do not praise them for showing up. Do not be vague. If a line was too short or abrupt, the note must quote a fuller French line that adds one word or one piece of grammar to what they already said. Glosses, yours and phrases are JSON arrays. ${ADDRESS}`,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "debrief" },
      messages: [{ role: "user", content: script }],
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 502 });
    const input = unwrap(toolUses(response)[0]?.input);
    const rawAnalysis = typeof input.analysis === "string" ? input.analysis : "";
    const phrases = asArray<{ fr?: string; en?: string }>(input.phrases)
      .filter((phrase) => typeof phrase.fr === "string" && typeof phrase.en === "string")
      .slice(0, 6)
      .map((phrase) => ({ fr: String(phrase.fr), en: String(phrase.en) }));
    review = {
      glosses: asArray<{ index?: number; en?: string }>(input.glosses)
        .filter((gloss) => Number.isInteger(gloss.index) && typeof gloss.en === "string")
        .map((gloss) => ({ index: gloss.index as number, en: String(gloss.en).slice(0, 400) })),
      yours: asArray<{ index?: number; said?: unknown; note?: string; en?: unknown }>(input.yours)
        .filter((item) => Number.isInteger(item.index) && typeof item.note === "string")
        .map((item) => ({
          index: item.index as number,
          said: labelForLine(typeof item.said === "string" ? item.said : "", lines.find((line) => line.index === item.index)?.text ?? ""),
          note: reviewProse(String(item.note)).slice(0, 400),
          en: typeof item.en === "string" ? item.en.slice(0, 300) : "",
        })),
      phrases: phrases.length ? phrases : phrasesBuriedIn(rawAnalysis),
      tip: typeof input.tip === "string" ? reviewProse(input.tip) : "",
      analysis: reviewProse(rawAnalysis).slice(0, 1200),
      gaps: asArray<{ id?: unknown; note?: unknown }>(input.gaps)
        .filter((item) => typeof item.id === "string" && handoutIds.has(item.id) && typeof item.note === "string")
        .map((item) => ({ id: String(item.id), note: String(item.note).slice(0, 160) }))
        .slice(0, 6),
      mastered: (Array.isArray(input.mastered) ? input.mastered : [])
        .filter((id): id is string => typeof id === "string" && handoutIds.has(id))
        .slice(0, 9),
    };
  }
  return NextResponse.json(review);
}
