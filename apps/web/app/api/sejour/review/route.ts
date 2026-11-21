import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "@/lib/anthropic";
import { ITEM_BY_ID } from "@/app/epicerie/data/items";
import { GESTURES, isGesture } from "@/app/epicerie/lib/gerard";
import { labelForLine, phrasesBuriedIn, reviewProse } from "@/app/epicerie/lib/french";
import { HANDOUT_IDS } from "@/app/sejour/data/handouts";
import { isScene, type SceneId } from "@/app/sejour/world/places";
import { baselineRatingsFromLines, capListening, cleanRatings, rubricText, SKILLS, type Ratings } from "@/app/sejour/world/skills";
import { getUserFromRequest } from "@/lib/auth/session";
import { getUserBundle, saveUserBundle } from "@/lib/db";
import { computeDomainCoverage, detectVocabUsedInLines, satisfiedProbeIds, updateVocabSrs } from "@/app/course/engine";
import { phrasesBeforeConfusion, transcriptIsLost } from "@/app/course/engine/pace";
import { compileTeacherBrief } from "@/lib/teacher";

export const maxDuration = 60;

interface Body {
  lines?: { role?: string; text?: string; pointed?: string; gesture?: string }[];
  scene?: string;
  readingAssist?: boolean;
}

const SAID = ["Understood", "Close", "English", "Unclear", "French"] as const;

const TOOL: Anthropic.Tool = {
  name: "debrief",
  description: "Record the review, A1 skill ratings, teacher scribe notes, grammar errors, and student facts for this conversation.",
  input_schema: {
    type: "object",
    properties: {
      glosses: {
        type: "array",
        description: "One entry per NPC line, using the index given.",
        items: {
          type: "object",
          properties: { index: { type: "integer" }, en: { type: "string" } },
          required: ["index", "en"],
        },
      },
      yours: {
        type: "array",
        description: "One entry per player line, using the index given.",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            said: {
              type: "string",
              enum: [...SAID],
              description: "Understood if the French moved the conversation along. French if the words are French. Close if almost French. English if English. Unclear if unclear.",
            },
            note: { type: "string", description: "One or two sentences. Quote the fuller French they could say next time." },
            en: { type: "string", description: "Plain English translation of this player line." },
          },
          required: ["index", "said", "note", "en"],
        },
      },
      analysis: {
        type: "string",
        description: "Three to five sentences of plain prose about this conversation: what they said, what worked, what to try next.",
      },
      phrases: {
        type: "array",
        description: "Three to five short reusable French phrases from this scene.",
        items: {
          type: "object",
          properties: { fr: { type: "string" }, en: { type: "string" } },
          required: ["fr", "en"],
        },
      },
      tip: { type: "string", description: "One concrete sentence for next time, in English." },
      gaps: {
        type: "array",
        description: `Lesson ids this scene showed they still need. Allowed ids: ${HANDOUT_IDS.join(", ")}.`,
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: [...HANDOUT_IDS] },
            note: { type: "string" },
          },
          required: ["id", "note"],
        },
      },
      mastered: {
        type: "array",
        description: "Lesson ids they handled properly in this scene.",
        items: { type: "string", enum: [...HANDOUT_IDS] },
      },
      ratings: {
        type: "object",
        description: "Score 0–4 for each skill that was relevant in this scene. Leave out skills that did not come up.",
        properties: Object.fromEntries(SKILLS.map((skill) => [skill, { type: "integer", minimum: 0, maximum: 4 }])),
      },
      errors: {
        type: "array",
        description: "Up to 4 concrete grammar or vocabulary mistakes made by the student in this scene so the Teacher can rep them tomorrow.",
        items: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Short topic tag, e.g. 'articles', 'partitives', 'tu_vs_vous', 'etre_avoir', 'negation', 'gender_agreement', 'numbers', 'venir_de', 'aller_au', 'passe_compose'",
            },
            said: { type: "string", description: "What the student actually said" },
            correct: { type: "string", description: "The corrected French phrasing" },
          },
          required: ["topic", "said", "correct"],
        },
      },
      facts: {
        type: "array",
        description: "Personal facts learned about the student during this conversation (e.g. name, hometown, country, job, hobby, dietary preference, family).",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "Short key like 'name', 'hometown', 'country', 'hobby', 'diet', 'job', 'family'" },
            value: { type: "string", description: "Fact value in plain English or French" },
          },
          required: ["key", "value"],
        },
      },
      scribe: {
        type: "string",
        description: "1-2 sentences of internal Teacher notebook observations about this student's performance, confidence, and what to emphasize tomorrow.",
      },
    },
    required: ["glosses", "yours", "analysis", "phrases", "tip", "ratings"],
  },
};

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

function sceneLabel(scene: SceneId): { who: string; desc: string } {
  switch (scene) {
    case "host":
      return { who: "Madame Rousseau", desc: "a conversation at home with Madame Rousseau in her kitchen or hall" };
    case "meal":
      return { who: "Madame Rousseau", desc: "eating together at Madame Rousseau's table and talking about the food" };
    case "boulangerie":
      return { who: "Martine (Baker)", desc: "buying bread or pastries from Martine at the village boulangerie" };
    case "epicerie":
      return { who: "Gérard (Shopkeeper)", desc: "buying groceries from Gérard at the village épicerie" };
    case "supermarche":
      return { who: "Élodie (Cashier)", desc: "reading French product labels and checking out at the Supermarché de Saint-Aubin" };
    case "bistro":
      return { who: "Théo (Waiter)", desc: "ordering food and drink at Le Petit Bistro" };
    case "auberge":
      return { who: "Serge (Waiter)", desc: "ordering a formal meal at L'Auberge de la Loire" };
    case "speedfriending":
      return { who: "Villager", desc: "a speed-friending chat at the village hall" };
    case "parc":
      return { who: "Friend", desc: "hanging out with a friend at the village park" };
    case "cinema":
      return { who: "Friend", desc: "talking with a friend before and after a short French film at the cinema" };
    case "sport":
      return { who: "Marc", desc: "playing five-a-side football with Marc's club" };
    case "pharmacie":
      return { who: "Pharmacist", desc: "explaining Madame Rousseau's symptoms and buying medicine at the pharmacie" };
    case "family":
      return { who: "Camille", desc: "lunch at home with Madame Rousseau and her granddaughter Camille" };
    default:
      return { who: "Madame Rousseau", desc: "a short French lesson with Madame Rousseau" };
  }
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });
  const body = (await req.json().catch(() => null)) as Body | null;
  const rawScene = body?.scene ?? "host";
  const scene: SceneId = isScene(rawScene) ? rawScene : rawScene === "friends" ? "speedfriending" : rawScene === "restaurant" ? "bistro" : rawScene === "shop" ? "epicerie" : "host";

  const lines = (Array.isArray(body?.lines) ? body.lines : [])
    .map((line, index) => ({
      index,
      role: line?.role === "gerard" || line?.role === "them" ? "gerard" : line?.role === "event" ? "event" : "you",
      text: typeof line?.text === "string" ? line.text.slice(0, 400) : "",
      pointed: typeof line?.pointed === "string" && ITEM_BY_ID[line.pointed] ? ITEM_BY_ID[line.pointed].en : "",
      gesture: isGesture(line?.gesture) ? GESTURES[line.gesture] : "",
    }))
    .filter((line) => line.text.trim() || line.pointed || line.gesture)
    .slice(-60);

  const playerTexts = lines.filter((line) => line.role === "you" && line.text.trim()).map((line) => line.text);
  const repeats = phrasesBeforeConfusion(lines.map((line) => ({ role: line.role === "you" ? "you" : "them", text: line.text })));
  const baseline = baselineRatingsFromLines(scene, playerTexts, {});

  if (!lines.some((line) => line.role === "gerard")) {
    return NextResponse.json({
      glosses: [],
      yours: [],
      phrases: [],
      tip: "",
      analysis: "",
      gaps: [],
      mastered: [],
      ratings: baseline,
    });
  }

  let teacherBriefBlock = "";
  const user = await getUserFromRequest(req).catch(() => null);
  const bundle = user ? await getUserBundle(user.id, user.timezone) : null;
  if (bundle) {
    teacherBriefBlock = `\n\nSTUDENT DOSSIER (use this context to personalize your coaching and scribe notes):\n${compileTeacherBrief(bundle)}`;
  }

  const { who, desc } = sceneLabel(scene);
  const script = lines
    .map((line) => {
      if (line.role === "event") return `(${line.text})`;
      const doing = [line.pointed ? `pointing at ${line.pointed}` : "", line.gesture].filter(Boolean).join(", ");
      const said = line.text.trim();
      const bodyText = [doing ? `(${doing})` : "", said].filter(Boolean).join(" ");
      return `[${line.index}] ${line.role === "gerard" ? who : "You"}: ${bodyText}`;
    })
    .join("\n");

  const handoutIds = new Set<string>(HANDOUT_IDS);
  const response = await createMessage(client, {
    max_tokens: 2400,
    system: `You are the A1 DELF Teacher & Coach reviewing ${desc}.
Cover both sides of the conversation using the actual words spoken.

Call debrief with:
- glosses: for every ${who} line, the index and a natural English translation.
- yours: for every "You" line, the index, a said label, a 1-2 sentence coaching note quoting a fuller French line they could say next time, and an English translation of what they said.
- analysis: three to five sentences of plain prose about what they managed and what to try next.
- phrases: three to five short reusable French phrases from this scene with English.
- tip: one concrete sentence for next time.
- gaps / mastered: lesson ids from [${HANDOUT_IDS.join(", ")}].
- ratings: integer 0–4 for each skill exercised in this conversation using this A1 rubric (2 = broken French that still gets the point across):
${rubricText()}
- errors: up to 4 specific grammar/vocab mistakes made by the student (topic, said, correct).
- facts: any personal facts the student revealed about themselves (name, hometown, country, hobby, diet, job, family).
- scribe: 1-2 sentences of internal Teacher notes for planning tomorrow's lesson and conversation probes. If they said they did not understand, or asked you to go slower, say so and name the French line that caused it. Do not treat that as failing the scene.

Vous is for Madame Rousseau, Gérard, Martine, the pharmacist, Serge at L'Auberge, and older adults. Tu is only for young friends (Léa, Marc, Chloé, Camille) or Théo at Le Petit Bistro.${teacherBriefBlock}`,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "debrief" },
    messages: [{ role: "user", content: script }],
  });

  if ("error" in response) {
    return NextResponse.json({
      glosses: [],
      yours: [],
      phrases: [],
      tip: "",
      analysis: "",
      gaps: [],
      mastered: [],
      ratings: baseline,
      error: response.error,
    });
  }

  const input = (toolUses(response)[0]?.input ?? {}) as Record<string, unknown>;
  const rawAnalysis = typeof input.analysis === "string" ? input.analysis : "";
  const phrases = asArray<{ fr?: string; en?: string }>(input.phrases)
    .filter((phrase) => typeof phrase.fr === "string" && typeof phrase.en === "string")
    .slice(0, 6)
    .map((phrase) => ({ fr: String(phrase.fr), en: String(phrase.en) }));

  const modelRatings = cleanRatings(input.ratings);
  const mergedRatings: Ratings = capListening({ ...modelRatings }, body?.readingAssist === true);
  for (const [k, v] of Object.entries(baseline) as [keyof Ratings, number][]) {
    if (k === "listening") continue;
    if (typeof v === "number" && (mergedRatings[k] ?? 0) < v) {
      mergedRatings[k] = v;
    }
  }
  const ratings = capListening(mergedRatings, body?.readingAssist === true);

  const cleanAnalysis = reviewProse(rawAnalysis).slice(0, 1200);
  const cleanTip = typeof input.tip === "string" ? reviewProse(input.tip) : "";

  if (user && bundle) {
    const now = new Date();
    const nowIso = now.toISOString();
    const courseDay = bundle.course.currentDay;
    const rawErrors = asArray<{ topic?: unknown; said?: unknown; correct?: unknown }>(input.errors);
    const parsedErrors = rawErrors
      .filter((e) => typeof e.topic === "string" && typeof e.said === "string" && typeof e.correct === "string")
      .slice(0, 4)
      .map((e, idx) => ({
        id: `err_${Date.now()}_${idx}`,
        day: courseDay,
        topic: String(e.topic).slice(0, 60),
        said: String(e.said).slice(0, 200),
        correct: String(e.correct).slice(0, 200),
        source: scene,
        createdAt: nowIso,
      }));
    bundle.errors.push(...parsedErrors);

    const rawFacts = asArray<{ key?: unknown; value?: unknown }>(input.facts);
    for (const f of rawFacts) {
      if (typeof f.key === "string" && typeof f.value === "string" && f.key.trim() && f.value.trim()) {
        const key = f.key.trim().toLowerCase().slice(0, 40);
        const value = f.value.trim().slice(0, 160);
        bundle.learnerFacts[key] = { key, value, updatedAt: nowIso };
      }
    }

    const usedVocabIds = detectVocabUsedInLines(playerTexts);
    const producedProbes = satisfiedProbeIds({
      day: courseDay,
      scene,
      playerLines: playerTexts,
      domainCoverage: computeDomainCoverage(bundle.vocab),
      lessonsCompleted: bundle.course.lessonsCompleted,
      alreadyFiredProbeIds: bundle.probeLog.map((entry) => entry.probeId),
    });
    for (const probeId of producedProbes) {
      bundle.probeLog.push({ day: courseDay, probeId, scene, at: nowIso });
    }
    const lost = transcriptIsLost(lines.map((line) => ({ role: line.role === "you" ? "you" : "them", text: line.text })));
    if (lost) {
      bundle.course.supportBand = "high";
      if (!Array.isArray(bundle.course.queuedDayVocabIds)) bundle.course.queuedDayVocabIds = [];
      for (const id of detectVocabUsedInLines(repeats.map((phrase) => phrase.fr))) {
        if (!bundle.course.queuedDayVocabIds.includes(id)) bundle.course.queuedDayVocabIds.push(id);
        const current = bundle.vocab[id];
        if (current && current.box > 0) {
          bundle.vocab[id] = { ...current, box: Math.max(0, current.box - 1), nextDueAt: nowIso };
        }
      }
      bundle.teacherNotes.push({
        id: `note_pace_${Date.now()}`,
        day: courseDay,
        createdAt: nowIso,
        kind: "scribe",
        body: `[pace] They asked to slow down. Drill next: ${repeats.map((phrase) => phrase.fr).join(" · ") || "the last line they heard"}.`,
      });
    }

    for (const vid of usedVocabIds) {
      const updated = updateVocabSrs(bundle.vocab[vid], vid, true, now);
      updated.usedInConvo = true;
      bundle.vocab[vid] = updated;
    }

    const scribeText = typeof input.scribe === "string" && input.scribe.trim()
      ? input.scribe.trim().slice(0, 400)
      : cleanAnalysis.slice(0, 250);
    if (scribeText) {
      bundle.teacherNotes.push({
        id: `note_${Date.now()}`,
        day: courseDay,
        createdAt: nowIso,
        kind: "scribe",
        body: `[${scene}] ${scribeText}`,
      });
    }

    bundle.interactions.push({
      id: `int_${Date.now()}`,
      day: courseDay,
      scene,
      createdAt: nowIso,
      ratings,
      analysis: cleanAnalysis,
      tip: cleanTip,
      errors: parsedErrors.map((e) => ({ topic: e.topic, said: e.said, correct: e.correct })),
      vocabUsed: usedVocabIds,
      facts: rawFacts
        .filter((f) => typeof f.key === "string" && typeof f.value === "string")
        .map((f) => ({ key: String(f.key), value: String(f.value) })),
      scribe: scribeText,
    });

    await saveUserBundle(user.id, bundle);
  }

  return NextResponse.json({
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
    tip: cleanTip,
    analysis: cleanAnalysis,
    gaps: asArray<{ id?: unknown; note?: unknown }>(input.gaps)
      .filter((item) => typeof item.id === "string" && handoutIds.has(item.id) && typeof item.note === "string")
      .map((item) => ({ id: String(item.id), note: String(item.note).slice(0, 160) }))
      .slice(0, 6),
    mastered: (Array.isArray(input.mastered) ? input.mastered : [])
      .filter((id): id is string => typeof id === "string" && handoutIds.has(id))
      .slice(0, 9),
    ratings,
    repeat: repeats,
  });
}
