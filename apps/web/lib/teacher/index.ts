import type Anthropic from "@anthropic-ai/sdk";
import { EXAM_BANK } from "@/app/course/content/exam-bank";
import { getDefaultDayPlan } from "@/app/course/content/plan";
import {
  computeDomainCoverage,
  selectExamItemsDeterministically,
  validateTeacherExamSelection,
} from "@/app/course/engine";
import {
  VOCAB_DOMAINS,
  type DayPlan,
  type ExamBankItem,
  type TeacherConversationNote,
  type VocabDomain,
} from "@/app/course/types";
import { PEOPLE } from "@/app/sejour/data/people";
import { isOuting, isScene, PLACES, type PlaceId } from "@/app/sejour/world/places";
import { anthropicClient, createMessage, toolUses } from "@/lib/anthropic";
import type { UserLearningBundle } from "@/lib/db";

export function compileTeacherBrief(bundle: UserLearningBundle): string {
  const { course, errors, teacherNotes, learnerFacts, vocab } = bundle;
  const coverage = computeDomainCoverage(vocab);
  const weakDomains = Object.values(coverage)
    .filter((c) => c.week <= Math.ceil(course.currentDay / 7) && !c.covered)
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 5)
    .map((c) => `${c.domain} (${c.percent}%)`);

  const coveredDomains = Object.values(coverage)
    .filter((c) => c.covered)
    .map((c) => c.domain);

  const recentErrors = errors
    .slice(-12)
    .map((e) => `- [Day ${e.day} · ${e.topic}] Student said: "${e.said}" → Better: "${e.correct}"`)
    .join("\n");

  const recentNotes = teacherNotes
    .slice(-8)
    .map((n) => `- [Day ${n.day} · ${n.kind}] ${n.body}`)
    .join("\n");

  const factsList = Object.values(learnerFacts)
    .map((f) => `${f.key}: ${f.value}`)
    .join("; ");

  return [
    `STUDENT PROFILE & PROGRESS (Day ${course.currentDay} of 28, Week ${Math.ceil(course.currentDay / 7)}):`,
    `- Streak: ${course.streak} days (Best: ${course.bestStreak}) | Support band: ${course.supportBand}`,
    `- Known personal facts about student: ${factsList || "none recorded yet"}`,
    `- Currently unlocked village places: ${course.unlockedPlaces.join(", ")}`,
    `- Completed grammar lessons: ${course.lessonsCompleted.join(", ") || "none yet"}`,
    `- Covered vocabulary domains: ${coveredDomains.join(", ") || "none yet"}`,
    `- Uncovered / weak vocabulary domains due: ${weakDomains.join(", ") || "all on track"}`,
    recentErrors ? `RECENT GRAMMAR / VOCAB MISTAKES:\n${recentErrors}` : "RECENT MISTAKES: None recorded yet.",
    recentNotes ? `TEACHER NOTEBOOK (recent scribe & daily summaries):\n${recentNotes}` : "TEACHER NOTEBOOK: First days of course.",
  ].join("\n");
}

const PLAN_DAY_TOOL: Anthropic.Tool = {
  name: "record_day_plan",
  description:
    "Record the orchestrated DayPlan for the student today: grammar lesson selection, personal note, unlocked village places/events, 1-2 hidden conversation notes for NPCs (including optional speed-friending outing invite prompt injection), and vocabulary focus domains.",
  input_schema: {
    type: "object",
    properties: {
      lessonId: {
        type: "string",
        description: "Grammar lesson ID for today (must be from the allowed pool; Days 1-2 are fixed).",
      },
      remediationLessonIds: {
        type: "array",
        items: { type: "string" },
        description: "0 to 2 earlier grammar lesson IDs to review if the student has recurring mistakes.",
      },
      personalIntro: {
        type: "string",
        description:
          "1-2 encouraging sentences shown on today's grammar card explaining why today's focus was chosen (e.g. referencing what they practiced or struggled with yesterday).",
      },
      unlockPlaces: {
        type: "array",
        items: { type: "string", enum: [...PLACES] },
        description:
          "Village places that should now be unlocked for the student (always include 'boulangerie'; unlock 'epicerie', 'speedfriending', 'bistro', 'auberge', 'supermarche' as they progress).",
      },
      unlockEvents: {
        type: "array",
        items: { type: "string", enum: ["family", "sick"] },
        description: "Special household events to unlock ('family' from Week 2+, 'sick' from Week 3+).",
      },
      conversationNotes: {
        type: "array",
        description:
          "1 or 2 hidden instructions injected into specific NPC conversations today to rep the student's weak grammar/vocab OR to prompt a speed-friending friend to invite the student on an outing ('parc', 'cinema', 'sport').",
        items: {
          type: "object",
          properties: {
            scene: { type: "string" },
            character: { type: "string" },
            inviteOuting: { type: "string", enum: ["parc", "cinema", "sport"] },
            note: { type: "string" },
          },
          required: ["scene", "note"],
        },
      },
      vocabFocusDomains: {
        type: "array",
        items: { type: "string", enum: [...VOCAB_DOMAINS] },
        description: "2 to 3 vocabulary domains to prioritize in tonight's flashcard & recall session.",
      },
    },
    required: ["lessonId", "personalIntro", "unlockPlaces", "conversationNotes", "vocabFocusDomains"],
  },
};

export async function planCourseDay(bundle: UserLearningBundle, day: number): Promise<DayPlan> {
  const clampedDay = Math.max(1, Math.min(28, day));
  const fallback = getDefaultDayPlan(clampedDay);

  // Merge already unlocked places from course state into fallback
  const basePlaces = new Set<PlaceId>(["boulangerie", ...bundle.course.unlockedPlaces, ...fallback.unlockedPlaces]);
  fallback.unlockedPlaces = Array.from(basePlaces);

  // Days 1 and 2 have fixed grammar lessons; if no errors/notes exist yet on Day 1, return the deterministic Day 1 plan immediately
  if (clampedDay === 1 && bundle.errors.length === 0 && bundle.teacherNotes.length === 0) {
    return fallback;
  }

  const client = anthropicClient();
  if ("error" in client) {
    return applyDeterministicTeacherAdjustments(bundle, fallback);
  }

  const brief = compileTeacherBrief(bundle);

  try {
    const response = await createMessage(client, {
      max_tokens: 900,
      tools: [PLAN_DAY_TOOL],
      tool_choice: { type: "tool", name: "record_day_plan" },
      system: `You are the hidden Teacher for a 4-week A1 French stay in Saint-Aubin ("Le Séjour").
The day's grammar lesson and the places stay on the calendar. Do not skip a day or open a place early. You write a short personalIntro and up to two conversationNotes. A note may ask someone to go a little slower, or a little faster, on today's French. Friend outings still need an invitation: when speedfriending is already on today's plan, a conversationNote for that scene may set inviteOuting to 'parc', 'cinema', or 'sport'.`,
      messages: [
        {
          role: "user",
          content: `${brief}\n\nDefault plan for Day ${clampedDay}: ${JSON.stringify(fallback)}\nCall record_day_plan now.`,
        },
      ],
    });

    if ("error" in response) {
      return applyDeterministicTeacherAdjustments(bundle, fallback);
    }

    const call = toolUses(response).find((t) => t.name === "record_day_plan");
    if (!call || !call.input || typeof call.input !== "object") {
      return applyDeterministicTeacherAdjustments(bundle, fallback);
    }

    const input = call.input as Record<string, unknown>;
    const personalIntro =
      typeof input.personalIntro === "string" && input.personalIntro.trim().length > 10
        ? input.personalIntro.trim().slice(0, 400)
        : fallback.personalIntro;

    const conversationNotes: TeacherConversationNote[] = [];
    if (Array.isArray(input.conversationNotes)) {
      for (const item of input.conversationNotes.slice(0, 2)) {
        if (!item || typeof item !== "object") continue;
        const raw = item as Record<string, unknown>;
        const scene = isScene(raw.scene) ? raw.scene : "host";
        const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 320) : "";
        if (!note) continue;
        const character = typeof raw.character === "string" ? raw.character.trim().slice(0, 32) : undefined;
        const inviteOuting = isOuting(raw.inviteOuting) ? raw.inviteOuting : undefined;
        conversationNotes.push({ scene, character, inviteOuting, note });
      }
    }

    const vocabFocusDomains = Array.isArray(input.vocabFocusDomains)
      ? input.vocabFocusDomains.filter((d): d is VocabDomain => VOCAB_DOMAINS.includes(d as VocabDomain)).slice(0, 3)
      : fallback.vocabFocusDomains;

    return applyDeterministicTeacherAdjustments(bundle, {
      ...fallback,
      personalIntro,
      conversationNotes: conversationNotes.length ? conversationNotes : fallback.conversationNotes,
      vocabFocusDomains: vocabFocusDomains.length ? vocabFocusDomains : fallback.vocabFocusDomains,
    });
  } catch {
    return applyDeterministicTeacherAdjustments(bundle, fallback);
  }
}

export function applyDeterministicTeacherAdjustments(bundle: UserLearningBundle, basePlan: DayPlan): DayPlan {
  const plan: DayPlan = {
    ...basePlan,
    unlockedPlaces: Array.from(new Set<PlaceId>(["boulangerie", ...bundle.course.unlockedPlaces, ...basePlan.unlockedPlaces])),
    conversationNotes: [...basePlan.conversationNotes],
  };

  // If the student has recent errors, inject a targeted Teacher note on Madame Rousseau or the shopkeeper to practice it
  const lastError = bundle.errors[bundle.errors.length - 1];
  if (lastError) {
    plan.personalIntro = `Yesterday in Saint-Aubin we noticed a small slip on "${lastError.said}" (try "${lastError.correct}"). Today's lesson and conversations will give you a chance to lock that in!`;
    if (plan.conversationNotes.length < 2) {
      plan.conversationNotes.push({
        scene: "host",
        character: "rousseau",
        note: `Naturally give the guest a chance to practice "${lastError.correct}" (they recently said "${lastError.said}").`,
      });
    }
  }

  // If speedfriending is unlocked and the student doesn't have an active outing invite yet, inject the Teacher's outing invitation prompt
  if (plan.unlockedPlaces.includes("speedfriending") && ! plan.conversationNotes.some((n) => n.inviteOuting)) {
    const targetPerson = PEOPLE[(plan.day - 1) % PEOPLE.length] ?? PEOPLE[0];
    plan.conversationNotes = [
      ...plan.conversationNotes.slice(0, 1),
      {
        scene: "speedfriending",
        character: targetPerson.id,
        inviteOuting: targetPerson.favoriteOuting,
        note: `Teacher directive: Ask the guest about their interests, and near the end of your chat, warmly invite them to go to ${targetPerson.favoriteOuting} with you tomorrow (« Tu veux aller au ${targetPerson.favoriteOuting} avec moi demain ? »). Only call the invite tool with "${targetPerson.favoriteOuting}" once they agree in French!`,
      },
    ];
  }

  return plan;
}

const SELECT_EXAM_TOOL: Anthropic.Tool = {
  name: "select_exam_items",
  description: "Select pre-authored exam question IDs from the A1 question bank for this week's exam.",
  input_schema: {
    type: "object",
    properties: {
      itemIds: {
        type: "array",
        items: { type: "string" },
        description: "Selected question IDs from the allowed bank.",
      },
      teacherIntro: {
        type: "string",
        description: "1-2 sentences introducing this week's exam focus.",
      },
    },
    required: ["itemIds"],
  },
};

export async function teacherSelectWeeklyExam(
  bundle: UserLearningBundle,
  kind: "w1" | "w2" | "w3" | "w4",
): Promise<ExamBankItem[]> {
  const maxWeek = kind === "w1" ? 1 : kind === "w2" ? 2 : kind === "w3" ? 3 : 4;
  const coverage = computeDomainCoverage(bundle.vocab);
  const weakDomains = Object.values(coverage)
    .filter((c) => c.week <= maxWeek && !c.covered)
    .map((c) => c.domain);
  const previousIds = bundle.exams.flatMap((e) => e.itemIds);

  const client = anthropicClient();
  if ("error" in client) {
    return selectExamItemsDeterministically(kind, weakDomains, previousIds);
  }

  const candidateCatalog = EXAM_BANK.filter((i) => i.week <= maxWeek).map((i) => ({
    id: i.id,
    section: i.section,
    week: i.week,
    topics: i.topics,
    domains: i.domains,
  }));

  try {
    const response = await createMessage(client, {
      max_tokens: 700,
      tools: [SELECT_EXAM_TOOL],
      tool_choice: { type: "tool", name: "select_exam_items" },
      system: `You are the hidden Teacher selecting questions from a pre-made A1 DELF question bank for exam ${kind.toUpperCase()} (max week ${maxWeek}).
You CANNOT invent questions; you must only pick IDs from the catalog provided.
Target quotas: ${kind === "w4" ? "5 listening, 5 reading, 8 language, 2 writing (20 total)" : "4 listening, 4 reading, 6 language, 1 writing (15 total)"}.
Prioritize items testing the student's weak domains (${weakDomains.join(", ") || "general"}) and recent mistakes.`,
      messages: [
        {
          role: "user",
          content: `${compileTeacherBrief(bundle)}\n\nAvailable Bank Catalog:\n${JSON.stringify(candidateCatalog)}\n\nCall select_exam_items now.`,
        },
      ],
    });
    if ("error" in response) {
      return selectExamItemsDeterministically(kind, weakDomains, previousIds);
    }
    const call = toolUses(response).find((t) => t.name === "select_exam_items");
    const ids = Array.isArray((call?.input as { itemIds?: unknown })?.itemIds)
      ? ((call!.input as { itemIds: unknown[] }).itemIds.filter((x): x is string => typeof x === "string"))
      : [];
    return validateTeacherExamSelection(ids, kind, weakDomains, previousIds);
  } catch {
    return selectExamItemsDeterministically(kind, weakDomains, previousIds);
  }
}

const GRADE_WRITING_TOOL: Anthropic.Tool = {
  name: "grade_writing",
  description: "Score an A1 student's short French writing response against the question rubric.",
  input_schema: {
    type: "object",
    properties: {
      scorePercent: { type: "number", description: "Score from 0 to 100." },
      feedback: { type: "string", description: "2-3 encouraging sentences explaining what worked and one correction." },
    },
    required: ["scorePercent", "feedback"],
  },
};

export async function teacherGradeWriting(params: {
  prompt: string;
  rubric: string[];
  answer: string;
}): Promise<{ scorePercent: number; feedback: string }> {
  const text = params.answer.trim();
  if (!text) {
    return { scorePercent: 0, feedback: "No French response was written for this section." };
  }

  const client = anthropicClient();
  if ("error" in client) {
    const wordCount = text.split(/\s+/).length;
    const score = Math.min(100, Math.round((wordCount / 15) * 85));
    return {
      scorePercent: score,
      feedback: `Good effort writing ${wordCount} words in French! Keep practicing the phrases from your phrasebook.`,
    };
  }

  try {
    const response = await createMessage(client, {
      max_tokens: 400,
      tools: [GRADE_WRITING_TOOL],
      tool_choice: { type: "tool", name: "grade_writing" },
      system: `You are an encouraging A1 DELF French examiner grading a beginner's short written response. Grade generously at an A1 level against these rubric points:\n- ${params.rubric.join("\n- ")}`,
      messages: [
        {
          role: "user",
          content: `Prompt: ${params.prompt}\n\nStudent's written French:\n"${text}"`,
        },
      ],
    });
    if ("error" in response) {
      return { scorePercent: 75, feedback: "Good A1 response!" };
    }
    const call = toolUses(response).find((t) => t.name === "grade_writing");
    const raw = (call?.input ?? {}) as { scorePercent?: unknown; feedback?: unknown };
    const scorePercent =
      typeof raw.scorePercent === "number" && Number.isFinite(raw.scorePercent)
        ? Math.max(0, Math.min(100, Math.round(raw.scorePercent)))
        : 75;
    const feedback =
      typeof raw.feedback === "string" && raw.feedback.trim()
        ? raw.feedback.trim().slice(0, 400)
        : "Good effort on the writing section!";
    return { scorePercent, feedback };
  } catch {
    return { scorePercent: 75, feedback: "Good effort on the writing section!" };
  }
}
