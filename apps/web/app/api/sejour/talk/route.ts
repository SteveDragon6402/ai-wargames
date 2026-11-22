import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { computeDomainCoverage, getFiringProbes } from "@/app/course/engine";
import { tutorDropsBy } from "@/app/course/content/spoken";
import { anthropicClient, createMessage, toolUses, textOf } from "@/lib/anthropic";
import { getUserFromRequest } from "@/lib/auth/session";
import { getGameSave, getUserBundle, saveUserBundle } from "@/lib/db";
import { cleanLine, forSpeech, GESTURES, isGesture, spokenFromText } from "@/app/epicerie/lib/gerard";
import { dinnerAsksAboutSleep } from "@/app/course/engine/pace";
import { eurosInWords, spellMoneyInSpeech } from "@/app/epicerie/lib/money-words";
import { BAKERY_ITEMS } from "@/app/sejour/data/bakery";
import { HANDOUT_IDS } from "@/app/sejour/data/handouts";
import { PERSON_BY_ID } from "@/app/sejour/data/people";
import { PHARMACIE_ITEMS } from "@/app/sejour/data/pharmacie";
import { RESTAURANT_BY_ID } from "@/app/sejour/data/restaurants";
import { parseSave } from "@/app/sejour/lib/save";
import type { Participant, SpokenTurn } from "@/app/sejour/lib/voice";
import { hostMorningAside } from "@/app/sejour/lib/morning-aside";
import { pendingEvent } from "@/app/sejour/world/events";
import { isOuting, isPlace, PLACE_INFO, PLACES, type OutingId, type PlaceId, type SceneId, type UnlockId } from "@/app/sejour/world/places";
import { cleanStageCall, filterInvite, filterSuggestedPlaces, type StageCall } from "@/app/sejour/world/stage";

export const maxDuration = 60;

export type TalkRole = "host" | "lesson" | "baker" | "waiter" | "friend" | "friend_outing" | "pharmacist" | "family" | "cashier";

interface Body {
  role?: TalkRole;
  who?: string;
  participants?: Participant[];
  history?: { who?: string; text?: string; speakerId?: string }[];
  said?: string;
  context?: string;
  memory?: string;
  opening?: boolean;
  gesture?: string;
  unlocked?: UnlockId[];
  knownFrench?: string[];
  notes?: string[];
}

function makeSpeakTool(participants: Participant[]): Anthropic.Tool {
  if (participants.length > 1) {
    const ids = participants.map((p) => p.id);
    const roster = participants.map((p) => `${p.id} (${p.name})`).join(", ");
    return {
      name: "speak",
      description: `Have one of the people in the room speak aloud (${roster}). Call it once for each person who has something to say this turn. Call speak last.`,
      input_schema: {
        type: "object",
        properties: {
          speaker: {
            type: "string",
            enum: ids,
            description: `Who is speaking this line: ${ids.join(" or ")}.`,
          },
          line: {
            type: "string",
            description: "What this person says, at the length they actually talk.",
          },
          audio: {
            type: "string",
            description: "The same words, with optional [warm] [short pause] [pleased] [amused] delivery tags.",
          },
        },
        required: ["speaker", "line", "audio"],
      },
    };
  }
  return {
    name: "speak",
    description: "Say the line aloud. Call this last.",
    input_schema: {
      type: "object",
      properties: {
        line: { type: "string", description: "What you say, at the length you actually talk." },
        audio: {
          type: "string",
          description: "The same words, with a few [warm] [short pause] [pleased] [firm] [amused] tags before the words they colour.",
        },
      },
      required: ["line", "audio"],
    },
  };
}

const ADD_PHRASE: Anthropic.Tool = {
  name: "add_phrase",
  description: "Put one useful French phrase into their phrasebook, with the English.",
  input_schema: {
    type: "object",
    properties: { fr: { type: "string" }, en: { type: "string" } },
    required: ["fr", "en"],
  },
};

const RECALL_TOOL: Anthropic.Tool = {
  name: "recall",
  description: "Look through your notebook and earlier conversations. Say what you are trying to remember.",
  input_schema: {
    type: "object",
    properties: { about: { type: "string" } },
    required: ["about"],
  },
};

const NOTE_TOOL: Anthropic.Tool = {
  name: "note",
  description: "Jot one short line in your notebook about this person.",
  input_schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
};

function withNotebook(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  return [RECALL_TOOL, NOTE_TOOL, ...tools];
}

function searchMemory(about: string, memory: string, notes: readonly string[]): string {
  const words = about
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9']+/)
    .filter((word) => word.length > 2);
  const filed = notes.map((line) => line.trim()).filter(Boolean);
  const lines = memory.split("\n").map((line) => line.trim()).filter(Boolean);
  const hit = (line: string) => {
    const hay = line.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return words.some((word) => hay.includes(word));
  };
  const noteHits = (words.length ? filed.filter(hit) : filed.slice(-8)).slice(0, 8);
  const lineHits = (words.length ? lines.filter(hit) : []).slice(-8);
  const parts: string[] = [];
  if (noteHits.length) parts.push(`Notebook:\n${noteHits.join("\n")}`);
  if (lineHits.length) parts.push(`From earlier talks:\n${lineHits.join("\n")}`);
  if (parts.length) return parts.join("\n\n");
  if (!filed.length && !lines.length) return "Nothing filed yet.";
  return words.length
    ? `Nothing on that. The notebook has ${filed.length} notes, and earlier talks run ${lines.length} lines.`
    : "Say what you want to look up.";
}

const STAGE_TOOL: Anthropic.Tool = {
  name: "stage",
  description: "Pop up a visual card, menu, form, or minigame on screen when it fits the moment.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["image", "minigame", "form", "menu", "clip"] },
      id: { type: "string" },
    },
    required: ["kind", "id"],
  },
};

function systemFor(
  body: Body,
  unlocked: readonly UnlockId[],
  participants: Participant[],
): { system: string; tools: Anthropic.Tool[] } {
  const speakTool = makeSpeakTool(participants);
  const notebook =
    "You keep a notebook. Earlier conversations are filed there. If something from before might matter, call recall. If you want to keep something, call note. Then say what you want to say.";
  const known =
    Array.isArray(body.knownFrench) && body.knownFrench.length
      ? `\nFrench they already know in their phrasebook: ${body.knownFrench.slice(0, 40).join("; ")}`
      : "";
  const unlockedPlaces = PLACES.filter((p) => unlocked.includes(p));
  const unlockedList = unlockedPlaces.length
    ? unlockedPlaces.map((p) => `${p} (${PLACE_INFO[p].fr} — ${PLACE_INFO[p].hint})`).join("\n- ")
    : "None yet — first help them learn to say hello and introduce themselves in French (Bonjour, je m'appelle…, je suis…).";

  const multiNote =
    participants.length > 1
      ? `\n\nOther people are in the room:\n${participants
          .map((p) => `- ${p.id} (${p.name}): ${p.blurb ?? ""}`)
          .join("\n")}\nIn a turn, call speak once for each person who actually has something to say, with their speaker id. They can answer each other. A name stays ??? until that person says it.`
      : "";

  if (body.role === "lesson") {
    return {
      tools: withNotebook([
        ADD_PHRASE,
        {
          name: "settled",
          description: "Call this once the guest has tried saying or practicing the lesson phrase in French.",
          input_schema: {
            type: "object",
            properties: { ids: { type: "array", items: { type: "string" } } },
            required: ["ids"],
          },
        },
        speakTool,
      ]),
      system: `You are Madame Rousseau, 71, at the kitchen table with your guest before they head out. You are the same woman they have breakfast with. The message describes the one small thing to look at together.

English is welcome here. French is still in the room. When they have a go at it, even roughly, call settled with the lesson id.

${notebook}
A phrase worth keeping goes in with add_phrase. Call speak last.`,
    };
  }

  if (body.role === "cashier") {
    return {
      tools: withNotebook([
        ADD_PHRASE,
        { name: "bill", description: "Ask for payment at the supermarket checkout.", input_schema: { type: "object", properties: {} } },
        speakTool,
      ]),
      system: `You are Élodie, on the checkout at the Supermarché de Saint-Aubin. Quick, cheerful, vous. French is the language of the till. You catch a tourist word sometimes, hello or thank you or something in the basket, and miss the rest.

Until you say "Élodie", the screen shows ???.

The total is in the message, in French words rather than digits. Money counts when the context says it was paid. Call bill when you are asking them to pay.
${notebook}
Call speak last.`,
    };
  }

  if (body.role === "host") {
    return {
      tools: withNotebook([
        ADD_PHRASE,
        {
          name: "suggest_place",
          description: "Surface a place option for the guest once you bring it up naturally in conversation. Only unlocked places work.",
          input_schema: {
            type: "object",
            properties: { place: { type: "string", enum: [...PLACES] } },
            required: ["place"],
          },
        },
        { name: "give_list", description: "Hand over today's shopping list.", input_schema: { type: "object", properties: {} } },
        { name: "give_cash", description: "Hand over the cash for the outing.", input_schema: { type: "object", properties: {} } },
        { name: "bedtime", description: "Invite them to head upstairs to bed when the evening talk is finished.", input_schema: { type: "object", properties: {} } },
        {
          name: "settled",
          description: "They have just managed these lesson/handout ids. Mark them done.",
          input_schema: {
            type: "object",
            properties: { ids: { type: "array", items: { type: "string" } } },
            required: ["ids"],
          },
        },
        STAGE_TOOL,
        speakTool,
      ]),
      system: `You are Madame Rousseau, 71, a widow on the rue des Tilleuls in Saint-Aubin-sur-Loire. You rent the spare room. Your guest is here to learn French. You notice the house: who finished the bread, who came home late, what the kitchen smells like. You talk the way you talk at your own table. You are not an assistant, and you never mention gates, unlocks, or buttons.

You spent a few years in England, so English is easy. French is how you normally talk, and you can speak English when you need to. Speak French with them, and help them learn it. When they don't understand what's happening, or they answer in English, switch as much as the moment needs. If English is where they're comfortable, you can give them more of it, and still push them a little. Even in an English sentence, some French usually comes along, the line you would actually have said.

Until you say "Madame Rousseau", the screen shows ???.
${known}

Places you can send them, once the morning gets there. Call suggest_place when you do:
- ${unlockedList}

A morning message may include a private aside about how the conversation should go. Follow it, and don't read it aloud. The message also says what part of the day this is.
${notebook}
When a French phrase is worth keeping, add_phrase. Call speak last.${multiNote}`,
    };
  }

  if (body.role === "family") {
    return {
      tools: withNotebook([
        ADD_PHRASE,
        { name: "end_chat", description: "Lunch conversation is wrapping up; time to eat.", input_schema: { type: "object", properties: {} } },
        STAGE_TOOL,
        speakTool,
      ]),
      system: `Lunch at the table. Madame Rousseau is here, and so is Camille, her granddaughter, 22, in from Dijon, a graphic design student. They talk with each other and with the guest. Call speak as rousseau and as camille.

Madame spent a few years in England. French is how she talks at home, and her guest is learning it, so she helps the way she does at breakfast. Camille uses tu. She knows some English from school and from series, a word or a short phrase, and she talks a little fast.

Names show as ??? until they are said.
${notebook}
When lunch has had a little time, end_chat. Call speak last.`,
    };
  }

  if (body.role === "baker") {
    const catalogue = BAKERY_ITEMS.map((item) => `${item.id}: ${item.fr} (${eurosInWords(item.price)})`).join("\n");
    return {
      tools: withNotebook([
        ADD_PHRASE,
        {
          name: "serve",
          description: "Put the bakery items they ordered on the counter, by item id.",
          input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
        },
        { name: "bill", description: "Ask for payment at the till.", input_schema: { type: "object", properties: {} } },
        STAGE_TOOL,
        speakTool,
      ]),
      system: `You are Martine, the baker at the Boulangerie de Saint-Aubin. Cheerful, brisk, flour on the apron, vous. The oven is on.

French is the language of the shop. You catch a tourist word now and then, bread or please or thank you, and miss the rest. You can guess, point, or try the sentence again.

Until you say "Martine", the screen shows ???.

When they order, serve those ids and call bill. Prices are the French words in the list. Money counts when the context says it was paid.

What you sell:
${catalogue}${multiNote}
${notebook}
Call speak last.`,
    };
  }

  if (body.role === "pharmacist") {
    const catalogue = PHARMACIE_ITEMS.map((item) => `${item.id}: ${item.fr} for ${item.symptomFr} (${eurosInWords(item.price)})`).join("\n");
    return {
      tools: withNotebook([
        ADD_PHRASE,
        {
          name: "serve",
          description: "Hand over the medicine they asked for or need for the symptoms described, by item id.",
          input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
        },
        { name: "bill", description: "Open the till for payment.", input_schema: { type: "object", properties: {} } },
        speakTool,
      ]),
      system: `You are Monsieur Moreau, the village pharmacist. Calm, precise, vous. People come in worried.

French is how you work. You know a few English words for pain, a cough, thank you, and you are unsure past that.

Until you say "Moreau", the screen shows ???.

They have come because Madame Rousseau is unwell. The message says how she is. When something on the list fits, serve those ids and call bill. Prices are the French words in the list. Money counts when the context says it was paid.

Medicines:
${catalogue}${multiNote}
${notebook}
Call speak last.`,
    };
  }

  if (body.role === "waiter") {
    const place = RESTAURANT_BY_ID[body.who ?? "bistro"] ?? RESTAURANT_BY_ID.bistro;
    const menu = place.menu.map((dish) => `${dish.id}: ${dish.fr} — ${dish.en} (${eurosInWords(dish.price)})`).join("\n");
    return {
      tools: withNotebook([
        ADD_PHRASE,
        {
          name: "serve",
          description: "Bring the dishes or drinks they ordered, by menu id.",
          input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
        },
        { name: "bill", description: "Put the bill on the table.", input_schema: { type: "object", properties: {} } },
        STAGE_TOOL,
        speakTool,
      ]),
      system: `You are ${place.waiter} at ${place.name}. ${place.room} ${place.older ? "You are older, formal, and you use vous. A little school English is still in there. A simple word sometimes lands. French is how you work." : "You are young, and you may use tu. You know some English from school and from customers, a word or a short phrase. French is how you work."}

Until you say "${place.waiter}", the screen shows ???.

When they want something on the menu, serve that id. When they want the bill, call bill. Prices are the French words on the menu. Money counts when the context says it was paid.

Menu:
${menu}${multiNote}
${notebook}
Call speak last.`,
    };
  }

  const person = PERSON_BY_ID[body.who ?? ""] ?? PERSON_BY_ID.paul;
  const canInvite = unlocked.some((u) => u === "invite_parc" || u === "invite_cinema" || u === "invite_sport");
  if (body.role === "friend_outing") {
    const hasDog = participants.some((p) => p.id === "pistache");
    return {
      tools: withNotebook([
        ADD_PHRASE,
        STAGE_TOOL,
        { name: "end_chat", description: "Wrap up the outing chat.", input_schema: { type: "object", properties: {} } },
        speakTool,
      ]),
      system: `You are ${person.name}, ${person.age}, out in Saint-Aubin. ${person.blurb} ${person.young ? "You use tu. You know some English from school and from films, a word or a short phrase. French is how you talk." : "You use vous. A little school English is still in there. French is how you talk."}${
        hasDog
          ? `\n\nPistache the dog is here too, speaker id "pistache". He gets a line of his own: a bark, a wag, a paw. His name shows as ??? until someone says it.`
          : ""
      }
Until you say your name, the screen shows ???.
${notebook}${multiNote}
Call speak last.`,
    };
  }

  return {
    tools: withNotebook([
      ADD_PHRASE,
      ...(canInvite
        ? [
            {
              name: "invite",
              description: "Invite them to hang out at the park, cinema, or football pitch.",
              input_schema: {
                type: "object" as const,
                properties: { outing: { type: "string", enum: ["parc", "cinema", "sport"] } },
                required: ["outing"],
              },
            },
          ]
        : []),
      { name: "end_chat", description: "Your three minutes at the table are up. End the conversation after this line.", input_schema: { type: "object", properties: {} } },
      speakTool,
    ]),
    system: `You are ${person.name}, ${person.age}, at a speed-friending evening in the village hall. ${person.blurb} You have a few minutes at this table, and you are curious about the person across from you. ${person.young ? "You use tu. You know some English from school and from films, a word or a short phrase, and French is still how you talk." : "You use vous. School English was a long time ago. A simple word sometimes lands. French is how you talk."}

Until you say your name, the screen shows ???.
${canInvite ? `If the conversation feels easy, you can invite them to ${person.favoriteOuting}. Call invite when you do.` : ""}${multiNote}
${notebook}
Call speak last.`,
  };
}

function plainLine(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The new line is the previous one again, or it ends by asking the same question. */
function repeatsPriorLine(previous: string, next: string): boolean {
  const prior = plainLine(previous);
  const spoken = plainLine(next);
  if (!prior || !spoken) return false;
  if (prior === spoken) return true;
  const priorEnd = prior.split(/\s+/).slice(-8).join(" ");
  const spokenEnd = spoken.split(/\s+/).slice(-8).join(" ");
  return priorEnd.length > 20 && priorEnd === spokenEnd;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });
  const body = (await req.json().catch(() => null)) as Body | null;
  const role = body?.role;
  if (
    role !== "host" &&
    role !== "lesson" &&
    role !== "baker" &&
    role !== "waiter" &&
    role !== "friend" &&
    role !== "friend_outing" &&
    role !== "pharmacist" &&
    role !== "family" &&
    role !== "cashier"
  ) {
    return NextResponse.json({ error: "Nobody is there." }, { status: 400 });
  }
  const said = typeof body?.said === "string" ? body.said.trim().slice(0, 400) : "";
  const opening = body?.opening === true;
  const gesture = isGesture(body?.gesture) ? GESTURES[body.gesture] : "";
  if (!said && !opening && !gesture) return NextResponse.json({ error: "Say something." }, { status: 400 });

  const defaultId = typeof body?.who === "string" && body.who ? body.who : "rousseau";
  const participants: Participant[] =
    Array.isArray(body?.participants) && body.participants.length > 0
      ? body.participants.filter((p): p is Participant => Boolean(p && typeof p.id === "string" && typeof p.name === "string"))
      : [{ id: defaultId, name: defaultId, character: defaultId }];
  const validSpeakerIds = new Set(participants.map((p) => p.id));

  const user = await getUserFromRequest(req);
  const bundle = user ? await getUserBundle(user.id, user.timezone) : null;

  // Unlocks come from the saved stay. Skill gates and the placement check decide them.
  // The browser's unlock list is ignored.
  const dbRecord = await getGameSave("sejour", user?.id).catch(() => ({ save: null }));
  const parsedDbSave = parseSave(dbRecord.save);
  const unlockedSet = new Set<UnlockId>(parsedDbSave?.unlocked ?? ["boulangerie"]);

  const context = typeof body?.context === "string" ? body.context.slice(0, 3200) : "";

  // Determine active SceneId & speed-friending slot for deterministic probes and Teacher notes
  const inferScene = (): SceneId => {
    if (role === "baker") return "boulangerie";
    if (role === "pharmacist") return "pharmacie";
    if (role === "cashier") return "supermarche";
    if (role === "waiter") return body?.who === "auberge" ? "auberge" : "bistro";
    if (role === "friend") return "speedfriending";
    if (role === "friend_outing") {
      if (/cin[eé]ma/i.test(context)) return "cinema";
      if (/foot|sport/i.test(context)) return "sport";
      return "parc";
    }
    if (role === "family") return "family";
    if (role === "lesson") return "lesson";
    if (/^MEAL\./i.test(context)) return "meal";
    return "host";
  };
  const currentScene = inferScene();
  const slotMatch = context.match(/Slot\s+(\d+)/i);
  const currentSlot = slotMatch ? Number(slotMatch[1]) : undefined;

  const npcAlreadySpoke = (Array.isArray(body?.history) ? body.history : []).some(
    (turn) => turn?.who === "them" && String(turn.text ?? "").trim(),
  );
  const memoryBank = typeof body?.memory === "string" ? body.memory.slice(0, 8000) : "";
  const filedNotes = (Array.isArray(body?.notes) ? body.notes : [])
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim().slice(0, 180))
    .filter(Boolean)
    .slice(-24);
  let tutorVisit = "";
  const directorNotes: string[] = [];
  if (bundle) {
    const courseDay = bundle.course.currentDay;
    const domainCoverage = computeDomainCoverage(bundle.vocab);
    const firingProbes = getFiringProbes({
      day: courseDay,
      scene: currentScene,
      role,
      slot: currentSlot,
      domainCoverage,
      lessonsCompleted: bundle.course.lessonsCompleted,
      alreadyFiredProbeIds: bundle.probeLog.map((entry) => entry.probeId),
    });
    for (const probe of firingProbes) {
      directorNotes.push(`Something that might belong here: ${probe.note}`);
    }

    const dayPlan = bundle.course.dayPlans[courseDay]?.plan;
    if (dayPlan) {
      for (const tNote of dayPlan.conversationNotes) {
        const sceneMatches = tNote.scene === currentScene || (tNote.scene === "host" && currentScene === "meal");
        const charMatches = !tNote.character || tNote.character === defaultId || participants.some((p) => p.id === tNote.character);
        if (sceneMatches && charMatches) {
          directorNotes.push(tNote.note);
        }
      }
    }

    const facts = Object.values(bundle.learnerFacts)
      .map((f) => `${f.key}: ${f.value}`)
      .join("; ");
    if (facts) {
      directorNotes.push(`[ABOUT THEM]: ${facts}`);
    }

    const lostOn = (parseSave(bundle.saves.sejour?.save)?.drill ?? []).map((item) => ({ fr: item.fr }));
    if (!npcAlreadySpoke && role !== "lesson") {
      tutorVisit = tutorDropsBy(bundle.course.currentDay, lostOn);
    }

    if (bundle.course.supportBand === "high") {
      directorNotes.push(`[PACE]: They're still new to French.`);
    } else if (bundle.course.supportBand === "low") {
      directorNotes.push(`[PACE]: They're comfortable in French.`);
    }

  }

  const unlocked = [...unlockedSet];
  const invite = parsedDbSave?.pendingInvite;
  const morningNote =
    role === "host"
      ? hostMorningAside({
          context,
          name: user?.name ?? "",
          places: unlocked.filter(isPlace),
          event: pendingEvent(unlocked, parsedDbSave?.eventsDone ?? [], parsedDbSave?.day ?? 0),
          invite: invite
            ? { outing: invite.outing, who: PERSON_BY_ID[invite.friendId]?.name ?? "a friend" }
            : null,
        })
      : "";

  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter((turn) => (turn?.who === "you" || turn?.who === "them") && typeof turn.text === "string")
    .slice(-24)
    .map((turn) => {
      if (turn.who === "you") return `Guest: ${String(turn.text).slice(0, 400)}`;
      const spk = turn.speakerId ? (participants.find((p) => p.id === turn.speakerId)?.name ?? turn.speakerId) : "You";
      return `${spk} (you): ${String(turn.text).slice(0, 400)}`;
    })
    .join("\n");
  const { system, tools } = systemFor(
    { ...body, memory: typeof body?.memory === "string" ? body.memory.slice(0, 2000) : "" },
    unlocked,
    participants,
  );
  const directorBlock = directorNotes.length
    ? `\n\nPrivate. Fold in what fits. Never mention notes, levels, or that you were told any of this.\n${directorNotes.join("\n")}`
    : "";
  const told = `${system}${directorBlock}

When you call speak, line is the words they hear, with no brackets. audio is those same words plus 1 to 3 delivery tags placed just before the words they colour: [warm] [pleased] [gentle] [amused] [curious] [hesitant] [surprised] [firm] [laughs] [chuckles] [sighs] [whispers] [short pause] [slow]. Example: "[warm] Bonjour ! [short pause] [pleased] Bienvenue chez moi."

A bracketed line from the guest is their gesture: a nod, a head shake, a shrug, a wave, or fingers held up. It needs no French. Answer the gesture even when they say nothing.`;
  const verbalPayClaim =
    (role === "baker" || role === "pharmacist" || role === "waiter" || role === "cashier") &&
    /PAID:\s*NO|Paid yet:\s*no/i.test(context) &&
    /\b(i paid|i've paid|i have paid|already paid|here is the money|here's the money|take the money|keep the change|c'est payé|j'ai payé|voilà l'argent|voici l'argent|tiens l'argent|je vous paye|je te paye)\b/i.test(
      said,
    );
  const paymentWarning = verbalPayClaim
    ? "\n[SYSTEM NOTE: The customer just claimed in words that they paid or offered money, but PAID is NO — they have NOT handed over any real coins or bills on the counter tray! Do NOT accept this as payment; call `bill` and tell them they haven't handed over the coins/notes on the tray yet!]"
    : "";
  const them =
    gesture && said
      ? `[They ${gesture}.]\nGuest: ${said}${paymentWarning}`
      : gesture
        ? `[They ${gesture}, and say nothing.]`
        : `Guest: ${said}${paymentWarning}`;
  const dinnerNow = /\bMEAL\./.test(context);
  const answerNow = opening ? "" : dinnerNow ? "\n\nThis is dinner." : "";

  const priorNpcLine = (Array.isArray(body?.history) ? body.history : [])
    .filter((turn) => turn?.who === "them" && typeof turn.text === "string")
    .map((turn) => String(turn.text))
    .at(-1) ?? "";

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: (opening && !said
        ? `${morningNote ? `${morningNote}\n\n` : ""}${tutorVisit ? `${tutorVisit}\n\n` : ""}${context}\n\n${history}\nThey are waiting. Speak first.`
        : `${morningNote ? `${morningNote}\n\n` : ""}${tutorVisit ? `${tutorVisit}\n\n` : ""}${context}\n\n${history}\n${them}${answerNow}`
      ).trim(),
    },
  ];

  const phrases: { fr: string; en: string }[] = [];
  const rawSuggested: unknown[] = [];
  let listed = false;
  let paid = false;
  let quiet = false;
  let left = false;
  let bedtime = false;
  let invited: OutingId | null = null;
  let stage: StageCall | null = null;
  const served: string[] = [];
  let billed = false;
  const settled: string[] = [];
  const allowedHandouts = new Set<string>(HANDOUT_IDS);
  const spokenTurns: SpokenTurn[] = [];
  const jotted: string[] = [];
  let rejectedRepeat = false;
  let rejectedSleep = false;

  for (let round = 0; round < 4; round++) {
    const response = await createMessage(client, { max_tokens: 900, system: told, tools, messages });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 502 });
    const calls = toolUses(response);
    if (!calls.length) {
      const spoken = spokenFromText(textOf(response));
      if (spoken) {
        const single: SpokenTurn = {
          speakerId: participants[0]?.id ?? defaultId,
          line: spoken.line,
          audio: forSpeech(spoken.line, ""),
        };
        return NextResponse.json({
          line: single.line,
          audio: single.audio,
          turns: [single],
          phrases,
          notes: jotted,
          suggestedPlaces: filterSuggestedPlaces(rawSuggested, unlocked),
          listed,
          paid,
          quiet,
          left,
          bedtime,
          invited,
          stage,
          served,
          billed,
          settled,
        });
      }
      return NextResponse.json({ error: "They said nothing." }, { status: 502 });
    }
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as Record<string, unknown>;
      const reply = (content: string) => results.push({ type: "tool_result", tool_use_id: call.id, content });
      if (call.name === "recall") {
        reply(searchMemory(String(input.about ?? ""), memoryBank, [...filedNotes, ...jotted]));
      } else if (call.name === "note") {
        const text = String(input.text ?? "").trim().slice(0, 180);
        if (text && !jotted.includes(text) && !filedNotes.includes(text)) jotted.push(text);
        reply(text ? "Noted." : "Write the note.");
      } else if (call.name === "add_phrase") {
        const fr = String(input.fr ?? "").trim().slice(0, 180);
        const en = String(input.en ?? "").trim().slice(0, 180);
        if (fr) phrases.push({ fr, en });
        reply(fr ? "In the book." : "Write the French.");
      } else if (call.name === "suggest_place") {
        const place = input.place;
        if (isPlace(place) && unlocked.includes(place)) {
          rawSuggested.push(place);
          reply(`Suggested ${place}.`);
        } else {
          reply("That place is not available yet. Keep chatting or suggest an available place.");
        }
      } else if (call.name === "give_list") {
        listed = true;
        reply("They have the list.");
      } else if (call.name === "give_cash") {
        paid = true;
        reply("They have the cash.");
      } else if (call.name === "bedtime") {
        bedtime = true;
        reply("They can head upstairs to bed after this line.");
      } else if (call.name === "invite") {
        const filtered = filterInvite(input.outing, unlocked);
        if (filtered) {
          invited = filtered;
          reply(`Invited them to ${filtered}.`);
        } else {
          reply("Not yet.");
        }
      } else if (call.name === "stage") {
        const cleaned = cleanStageCall(input);
        if (cleaned) {
          stage = cleaned;
          reply(`Staged ${cleaned.kind}:${cleaned.id}.`);
        } else {
          reply("Unknown stage item.");
        }
      } else if (call.name === "gone_quiet") {
        quiet = true;
        reply("You stop. Say this last line, then nothing more.");
      } else if (call.name === "walk_off" || call.name === "end_chat") {
        left = true;
        reply("You are wrapping up after this line.");
      } else if (call.name === "serve") {
        const ids = Array.isArray(input.ids) ? input.ids.map((id) => String(id)).slice(0, 6) : [];
        served.push(...ids);
        reply(ids.length ? "Brought." : "Say which items.");
      } else if (call.name === "bill") {
        billed = true;
        reply("The bill is on the counter/table.");
      } else if (call.name === "settled") {
        const ids = Array.isArray(input.ids) ? input.ids.map((id) => String(id)) : [];
        for (const id of ids) {
          if (allowedHandouts.has(id) && !settled.includes(id)) settled.push(id);
        }
        reply(settled.length ? "Settled." : "Name a valid lesson id.");
      } else if (call.name === "speak") {
        const cleanedLine = spellMoneyInSpeech(cleanLine(String(input.line ?? "")));
        const cleanedAudio = spellMoneyInSpeech(forSpeech(cleanedLine, input.audio));
        const rawSpeaker = typeof input.speaker === "string" && validSpeakerIds.has(input.speaker) ? input.speaker : (participants[0]?.id ?? defaultId);
        if (cleanedLine) {
          spokenTurns.push({
            speakerId: rawSpeaker,
            line: cleanedLine,
            audio: cleanedAudio,
          });
          reply("Said.");
          if (
            ((role === "waiter" || role === "baker" || role === "pharmacist" || role === "cashier") &&
              /addition|euros?|centimes?|ça fait|comptoir|monnaie|réglé|payer/i.test(cleanedLine)) ||
            verbalPayClaim
          ) {
            billed = true;
          }
        } else {
          reply("Say something.");
        }
      } else {
        reply("No.");
      }
    }
    if (spokenTurns.length > 0) {
      const combinedLine = spokenTurns.map((t) => t.line).join(" ");
      const lower = combinedLine.toLowerCase();
      if (role === "host" || role === "family") {
        if (/boulangerie|\bpain\b|baguette/.test(lower)) rawSuggested.push("boulangerie");
        if (/épicerie|epicerie|cuisin|recette|courses/.test(lower)) rawSuggested.push("epicerie");
        if (/supermarch[eé]/.test(lower)) rawSuggested.push("supermarche");
        if (/speed.?friend|salle des fêtes|rencontr/.test(lower)) rawSuggested.push("speedfriending");
        if (/bistro/.test(lower)) rawSuggested.push("bistro");
        if (/auberge/.test(lower)) rawSuggested.push("auberge");
      }
      if (dinnerNow && !rejectedSleep && dinnerAsksAboutSleep(combinedLine)) {
        rejectedSleep = true;
        spokenTurns.length = 0;
        for (const result of results) {
          if (result.content === "Said.") {
            result.content = "This is dinner, not the morning. Do not ask if they slept. Talk about the food and the day. Call speak with a new line.";
          }
        }
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: results });
        continue;
      }
      if (!opening && !rejectedRepeat && repeatsPriorLine(priorNpcLine, combinedLine)) {
        rejectedRepeat = true;
        spokenTurns.length = 0;
        for (const result of results) {
          if (result.content === "Said.") {
            result.content = `Do not say that. It repeats your previous line. The guest just said: "${said}". Answer that, and do not ask the same question again. Call speak with a new line.`;
          }
        }
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: results });
        continue;
      }
      if (billed && served.length === 0 && /nothing yet|nothing\./i.test(context)) {
        const searchPool = `${said} ${combinedLine}`.toLowerCase();
        if (role === "baker") {
          for (const item of BAKERY_ITEMS) {
            const key = item.fr.replace(/^(une?|des|du|la|le)\s+/i, "").toLowerCase();
            if (searchPool.includes(key) || searchPool.includes(item.id.replace(/_/g, " "))) {
              served.push(item.id);
            }
          }
        } else if (role === "pharmacist") {
          for (const item of PHARMACIE_ITEMS) {
            if (searchPool.includes(item.id) || (item.id === "sirop" && /toux|sirop/.test(searchPool)) || (item.id === "pastilles" && /gorge|pastille/.test(searchPool))) {
              served.push(item.id);
            }
          }
        } else if (role === "waiter") {
          const place = RESTAURANT_BY_ID[body?.who ?? "bistro"] ?? RESTAURANT_BY_ID.bistro;
          for (const dish of place.menu) {
            const key = dish.fr.replace(/^(une?|des|du|la|le)\s+/i, "").split(/\s+/)[0]?.toLowerCase() ?? "";
            if (key.length >= 4 && searchPool.includes(key)) {
              served.push(dish.id);
            }
          }
        }
      }
      return NextResponse.json({
        line: combinedLine,
        audio: spokenTurns[0].audio,
        turns: spokenTurns,
        phrases,
        notes: jotted,
        suggestedPlaces: filterSuggestedPlaces(rawSuggested, unlocked),
        listed,
        paid,
        quiet,
        left,
        bedtime,
        invited,
        stage,
        served,
        billed,
        settled,
      });
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }
  return NextResponse.json({ error: "They lost the thread." }, { status: 502 });
}
