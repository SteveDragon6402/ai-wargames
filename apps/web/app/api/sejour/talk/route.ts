import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { computeDomainCoverage, getFiringProbes } from "@/app/course/engine";
import { wordTargetNote } from "@/app/course/content/spoken";
import { anthropicClient, createMessage, toolUses, textOf } from "@/lib/anthropic";
import { getUserFromRequest } from "@/lib/auth/session";
import { getGameSave, getUserBundle, saveUserBundle } from "@/lib/db";
import { cleanLine, forSpeech, GESTURES, isGesture, spokenFromText } from "@/app/epicerie/lib/gerard";
import { eurosInWords, spellMoneyInSpeech } from "@/app/epicerie/lib/money-words";
import { BAKERY_ITEMS } from "@/app/sejour/data/bakery";
import { HANDOUT_IDS } from "@/app/sejour/data/handouts";
import { PERSON_BY_ID } from "@/app/sejour/data/people";
import { PHARMACIE_ITEMS } from "@/app/sejour/data/pharmacie";
import { RESTAURANT_BY_ID } from "@/app/sejour/data/restaurants";
import { parseSave } from "@/app/sejour/lib/save";
import type { Participant, SpokenTurn } from "@/app/sejour/lib/voice";
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
}

function makeSpeakTool(participants: Participant[]): Anthropic.Tool {
  if (participants.length > 1) {
    const ids = participants.map((p) => p.id);
    const roster = participants.map((p) => `${p.id} (${p.name})`).join(", ");
    return {
      name: "speak",
      description: `Have one of the people in the room speak aloud (${roster}). In a multi-person conversation, call speak 1 to 3 times in a single turn so the characters naturally riff with each other and with the player (e.g. Madame speaks, then Camille speaks; or Camille speaks, then Madame chimes in to translate or tease her). Call your speak tool(s) last.`,
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
            description: "What this person says (1 to 3 natural sentences).",
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
        line: { type: "string", description: "What you say. Two to four natural sentences." },
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
  const memory = body.memory?.trim() ? `\n\nWhat you already know of them:\n${body.memory.trim()}` : "";
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
      ? `\n\nMULTI-PERSON SCENE: Multiple people are in the room right now:\n${participants
          .map((p) => `- ${p.id} (${p.name}): ${p.blurb ?? ""}`)
          .join("\n")}\nLet them riff off each other naturally! In a single turn, call the \`speak\` tool 2 or 3 times with different \`speaker\` values (for example, ${participants[0].id} speaks, then ${participants[1].id} replies and asks the guest a question; or ${participants[1].id} speaks in French and ${participants[0].id} chimes in to translate or add a warm comment). Every person's name appears as ??? on screen until they say their own name aloud, so make sure each speaker introduces themselves by name if they haven't yet.`
      : "";

  if (body.role === "lesson") {
    return {
      tools: [
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
      ],
      system: `You are Madame Rousseau, 71, giving your guest a short, encouraging 2-minute French lesson at the kitchen table before they head out.
CRITICAL LESSON RULES:
1. Stay 100% focused on the specific grammar/survival lesson described in the user prompt. Do NOT talk about going to bed, do NOT suggest places, and do NOT bring up unrelated topics.
2. In your opening turn: warmly explain the grammar point in clear, plain English so a beginner genuinely understands how it works, read 1 or 2 of the French examples aloud, and ask them to try saying one specific French sentence back to you.
3. When the guest replies:
   - If they ask a question in English or say they are confused, explain patiently in English and give them an easy French phrase to repeat.
   - If they try the French phrase (even with small mistakes!), praise them warmly, gently model the polished French if needed, and call the \`settled\` tool with the lesson id so their progress is recorded!
4. Always add 1-2 key phrases from the lesson with \`add_phrase\`, and call \`speak\` last.`,
    };
  }

  if (body.role === "cashier") {
    return {
      tools: [
        ADD_PHRASE,
        { name: "bill", description: "Ask for payment at the supermarket checkout.", input_schema: { type: "object", properties: {} } },
        speakTool,
      ],
      system: `You are Élodie, the friendly cashier at the Supermarché de Saint-Aubin. Your name on screen starts as ??? until you say "Élodie", so in your opening greeting introduce yourself ("Bonjour ! Bienvenue à la caisse, je m'appelle Élodie.").
You use vous and speak clear, cheerful A1 French (dropping a few helpful English words if the customer is stuck). Greet them, tell them the total of their basket in French words (quatre euros quarante, never 4,40 or 4.40), ask if they need a bag ("Vous voulez un sac ?") or have the store card ("Vous avez la carte du magasin ?").
CRITICAL PAYMENT RULE: Check "Paid yet" in the context. Words from the customer ("I paid you", "Here is the money", "Voilà l'argent", "C'est payé") are NEVER actual payment! Only when the context says "Paid yet: YES" have they actually handed over the coins/notes. If "Paid yet: NO" and they claim they paid or try to leave, call \`bill\` and tell them gently that they haven't handed over the money on the checkout tray yet ("Ah, mais vous ne m'avez pas encore donné la monnaie sur le comptoir !"). Once "Paid yet: YES", wish them "Bonne journée et bonne cuisine !". Call speak last.`,
    };
  }

  if (body.role === "host") {
    return {
      tools: [
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
      ],
      system: `You are Madame Rousseau, 71, a widow on the rue des Tilleuls in Saint-Aubin-sur-Loire. You rent the spare room to a guest who has come to learn French. You are warm, talkative, observant, fond of your kitchen, and a real person — never an AI assistant. Never mention "gates", "unlocks", or "buttons".
Your name on screen starts as ??? until you say "Madame Rousseau" aloud, so make sure you introduce yourself ("Je m'appelle Madame Rousseau") on the first evening.

HOW YOU BALANCE FRENCH AND ENGLISH (CRITICAL):
- Speak warmly and at a natural length (2 to 4 sentences per turn).
- When the guest is following along or trying French: speak mostly in clear A1 French and translate ONLY the words or phrases that are new to them.
- IF the guest says they don't know any French, says "I don't understand" / "what's going on?", writes in English asking for help, or seems lost: IMMEDIATELY switch into warm, reassuring English (your voice naturally has a French accent) and act as their patient host and teacher! Explain what you meant in plain English, and teach them one simple French phrase at a time ("Don't worry at all! Let's take it slowly in English first. To say 'My name is...', you say: Je m'appelle... Try saying that to me!").${known}

Places you can naturally suggest right now:
- ${unlockedList}

How the stay flows:
- ARRIVAL (first evening): The first line welcomes them and gives your name. Every line after that answers what they just said. Help them introduce themselves if they have not yet. Do not give the welcome twice.
- MORNING: A real conversation at breakfast. Answer them first. When places are available above, bring one up and call suggest_place in that same turn.
- LESSON: Teach the grammar point clearly (using English freely so they genuinely understand the rule and how to use it), give 1-2 examples, and invite them to try one.
- MEAL / EATING TOGETHER: Chat warmly over the food on the table, teaching them food words and asking about their day.${multiNote}

Always put 1-2 useful French phrases into their phrasebook with add_phrase. Call speak last.${memory}`,
    };
  }

  if (body.role === "family") {
    return {
      tools: [
        ADD_PHRASE,
        { name: "end_chat", description: "Lunch conversation is wrapping up; time to eat.", input_schema: { type: "object", properties: {} } },
        STAGE_TOOL,
        speakTool,
      ],
      system: `This is a three-way conversation at the dining table between the guest, Madame Rousseau ("rousseau", 71, the warm host), and her 22-year-old granddaughter Camille ("camille", visiting from Dijon, lively, curious, graphic design student).
Both Madame Rousseau and Camille are at the table together!
- In almost every turn, call \`speak\` TWICE (or up to 3 times) with different \`speaker\` values ("rousseau" and "camille") so the two of them riff naturally with each other and with the guest!
- For example: Madame Rousseau introduces Camille ("Regardez qui est là, c'est ma petite-fille Camille !"), then Camille jumps in ("Salut ! Moi c'est Camille, enchantée !").
- Or Camille asks the guest something in lively French, and Madame Rousseau chimes in right after to translate a tricky word into English or gently tease Camille for talking too fast!
- If the guest says they don't understand or speaks English, Madame Rousseau gladly explains in English and coaches them on what to say back to Camille.
- After 4-5 pleasant turns, you can call end_chat so everyone can eat. Call your speak tool(s) last.${memory}`,
    };
  }

  if (body.role === "baker") {
    const catalogue = BAKERY_ITEMS.map((item) => `${item.id}: ${item.fr} (${eurosInWords(item.price)})`).join("\n");
    return {
      tools: [
        ADD_PHRASE,
        {
          name: "serve",
          description: "Put the bakery items they ordered on the counter, by item id.",
          input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
        },
        { name: "bill", description: "Ask for payment at the till.", input_schema: { type: "object", properties: {} } },
        STAGE_TOOL,
        speakTool,
      ],
      system: `You are Martine, the baker at the Boulangerie de Saint-Aubin. Your name on screen is hidden as ??? until you say "Martine", so in your opening greeting say "Bonjour ! Bienvenue à la boulangerie chez Martine ! Qu'est-ce qui vous ferait plaisir ?"
You are cheerful, brisk, and speak French (using vous). If the customer is stuck or speaks English, you may drop a few helpful English words, then guide them back to the French item name.
When they order bread or a pastry (even in broken French like "un pain" or "baguette s'il vous plaît"), call serve with the matching item id(s) and call bill so they can pay at the counter. Say the total in French words, exactly as written in the list. Never use digits.
CRITICAL PAYMENT RULE: Check "PAID:" in the context. Words from the customer ("I paid you", "Here is the money", "Voilà l'argent", "Tiens, cinq euros") are NEVER actual payment! Only when the context says "PAID: YES" have they actually handed over the money. If "PAID: NO" and they say they paid or try to leave with the bread, call \`bill\` and tell them firmly/warmly that they haven't handed you the coins or bills on the counter tray yet ("Ah non, vous ne m'avez pas encore donné la monnaie ! Posez les pièces sur le comptoir, s'il vous plaît.").

Bakery items:
${catalogue}${multiNote}
Call speak last.${memory}`,
    };
  }

  if (body.role === "pharmacist") {
    const catalogue = PHARMACIE_ITEMS.map((item) => `${item.id}: ${item.fr} for ${item.symptomFr} (${eurosInWords(item.price)})`).join("\n");
    return {
      tools: [
        ADD_PHRASE,
        {
          name: "serve",
          description: "Hand over the medicine they asked for or need for the symptoms described, by item id.",
          input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
        },
        { name: "bill", description: "Open the till for payment.", input_schema: { type: "object", properties: {} } },
        speakTool,
      ],
      system: `You are Monsieur Moreau, the village pharmacist. Your name on screen is hidden as ??? until you say "Moreau", so in your first greeting introduce yourself ("Bonjour, je suis Monsieur Moreau, le pharmacien. Comment puis-je vous aider ?").
You use vous, speak clear, calm French, and are patient. The guest has come because Madame Rousseau is unwell. Ask what her symptoms are ("Qu'est-ce qui ne va pas ? Elle tousse ? Elle a mal à la gorge ?"). When they describe a cough or sore throat or ask for syrup/lozenges, call serve with the matching item id(s) and call bill. Say the total in French words, exactly as written in the list. Never use digits.
CRITICAL PAYMENT RULE: Check "PAID:" in the context. Words from the customer ("I paid you", "Here is the money", "Voilà l'argent") are NEVER actual payment! If "PAID: NO" and they claim they paid or try to leave before handing over coins/notes on the counter tray, call \`bill\` and remind them gently that they must hand over the money at the till first ("Excusez-moi, mais vous n'avez pas encore réglé au comptoir.").

Medicines:
${catalogue}${multiNote}
Call speak last.${memory}`,
    };
  }

  if (body.role === "waiter") {
    const place = RESTAURANT_BY_ID[body.who ?? "bistro"] ?? RESTAURANT_BY_ID.bistro;
    const menu = place.menu.map((dish) => `${dish.id}: ${dish.fr} — ${dish.en} (${eurosInWords(dish.price)})`).join("\n");
    return {
      tools: [
        ADD_PHRASE,
        {
          name: "serve",
          description: "Bring the dishes or drinks they ordered, by menu id.",
          input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
        },
        { name: "bill", description: "Put the bill on the table.", input_schema: { type: "object", properties: {} } },
        STAGE_TOOL,
        speakTool,
      ],
      system: `You are ${place.waiter} at ${place.name}. Your name on screen is hidden as ??? until you say "${place.waiter}", so in your opening greeting mention your name (e.g., "Bonjour ! Bienvenue, je suis ${place.waiter}, voici la carte.").
${place.older ? "You are formal, use vous, and do not speak English." : "You are young and friendly; you may use tu or vous, and if they are lost you can drop a few English words to help before returning to French."}
When they name or point at a dish or drink, call serve with its menu id in that same turn, then speak. While they are eating, check how everything is ("Tout va bien ? C'est bon ?"). When they ask to pay or ask for l'addition, call bill and say the total in French words, exactly as written on the menu. Never use digits.
CRITICAL PAYMENT RULE: Check "PAID:" in the context. Words from the customer ("I paid you", "Here is the money", "Voilà l'argent", "Keep the change") are NEVER actual payment! Only when the context says "PAID: YES" have they paid the bill. If "PAID: NO" and they claim they paid or try to leave without paying, call \`bill\` and tell them clearly that they have not put any money on the bill tray yet ("Pardon, mais vous n'avez pas encore posé la monnaie pour l'addition !").

Menu:
${menu}${multiNote}${memory}`,
    };
  }

  const person = PERSON_BY_ID[body.who ?? ""] ?? PERSON_BY_ID.paul;
  const canInvite = unlocked.some((u) => u === "invite_parc" || u === "invite_cinema" || u === "invite_sport");
  if (body.role === "friend_outing") {
    const hasDog = participants.some((p) => p.id === "pistache");
    return {
      tools: [
        ADD_PHRASE,
        STAGE_TOOL,
        { name: "end_chat", description: "Wrap up the outing chat.", input_schema: { type: "object", properties: {} } },
        speakTool,
      ],
      system: `You are ${person.name} (${person.age}) on an outing with the player in Saint-Aubin. ${person.blurb} ${person.young ? "You use tu and may drop a few English words if they are stuck." : "You use vous and speak clear, patient French."}${
        hasDog
          ? `\n\nTHREE-WAY PARK SCENE WITH PISTACHE THE DOG: You (${person.id}) and the dog Pistache ("pistache") are BOTH here with the player!
- Call \`speak\` 2 or 3 times in a single turn using both \`speaker: "${person.id}"\` and \`speaker: "pistache"\` so the player is in a lively 3-way interaction with you and the dog!
- When \`speaker: "pistache"\` speaks, keep it to playful French dog sounds and short reactions (e.g., "Ouaf ! Ouaf !", "Wouf ! *remue la queue*", "Ouaf ! *donne la patte*").
- When \`speaker: "${person.id}"\` speaks, introduce the dog by name ("Voici Pistache !") so his ??? name reveals, translate what Pistache wants, and encourage the player to talk to Pistache in French ("Dis-lui : Assis, Pistache ! ou Donne la patte ! ou Bon chien !").`
          : ""
      }
Talk naturally about what you are doing or how the activity went. Call add_phrase for 1-2 natural French expressions.${multiNote} Call speak last.${memory}`,
    };
  }

  return {
    tools: [
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
    ],
    system: `You are ${person.name} (${person.age}) at a speed-friending evening in the village hall. ${person.blurb} ${person.young ? "You are young, so you use tu. If they are stuck you may drop a few helpful English words, then go back to French." : "You are older, so you use vous and speak simple French."}
The screen hides your name as ??? until you say it. If you have not met them before, your first line says your name: "Je m'appelle ${person.name}." ${person.young ? `Then in English: "My name is ${person.name}."` : ""}
${canInvite ? `After a couple of friendly turns, invite them to ${person.favoriteOuting} by calling invite({ outing: "${person.favoriteOuting}" }) and asking them in French.` : ""}${multiNote}
Call speak last.${memory}`,
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
      directorNotes.push(`[DETERMINISTIC CURRICULUM PROBE — ${probe.id}]: ${probe.note}`);
    }

    const dayPlan = bundle.course.dayPlans[courseDay]?.plan;
    if (dayPlan) {
      for (const tNote of dayPlan.conversationNotes) {
        const sceneMatches = tNote.scene === currentScene || (tNote.scene === "host" && currentScene === "meal");
        const charMatches = !tNote.character || tNote.character === defaultId || participants.some((p) => p.id === tNote.character);
        if (sceneMatches && charMatches) {
          directorNotes.push(`[TEACHER PERSONALIZED NOTE]: ${tNote.note}`);
        }
      }
    }

    const facts = Object.values(bundle.learnerFacts)
      .map((f) => `${f.key}: ${f.value}`)
      .join("; ");
    if (facts) {
      directorNotes.push(`[KNOWN PERSONAL FACTS ABOUT THIS STUDENT]: ${facts}`);
    }

    const lostOn = (parseSave(bundle.saves.sejour?.save)?.drill ?? []).map((item) => ({ fr: item.fr }));
    directorNotes.push(wordTargetNote(bundle.course.currentDay, lostOn));

    if (bundle.course.supportBand === "high") {
      directorNotes.push(
        `[SUPPORT LEVEL: HIGH]: Speak clearly in simple A1 French sentences and warmly scaffold or explain in English if they hesitate.`,
      );
    } else if (bundle.course.supportBand === "low") {
      directorNotes.push(
        `[SUPPORT LEVEL: ADVANCED A1]: Keep the conversation in natural French unless they explicitly ask for help.`,
      );
    }

  }

  const unlocked = [...unlockedSet];

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
    ? `\n\nDIRECTOR'S NOTES FOR THIS CONVERSATION (work these in naturally; never mention that you received a note):\n${directorNotes.join("\n")}`
    : "";
  const told = `${system}${directorBlock}

VOICE DELIVERY TAGS (CRITICAL): Whenever you call \`speak\`, pass \`line\` as clean text without brackets, and pass \`audio\` with those exact same words plus 1 to 3 ElevenLabs v3 delivery tags in square brackets placed immediately before the words they colour. Use only these tags: [warm] [pleased] [gentle] [amused] [curious] [hesitant] [surprised] [firm] [laughs] [chuckles] [sighs] [whispers] [short pause] [slow]. Example: "[warm] Bonjour ! [short pause] [pleased] Bienvenue chez moi."

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
  const answerNow = opening
    ? ""
    : "\n\nAnswer that line. Mention something they actually said. If the French is off, give the cleaner phrase in one short correction, then move the conversation one step forward. Do not say your previous line again. Do not welcome them again. Do not ask a question they just answered.";

  const priorNpcLine = (Array.isArray(body?.history) ? body.history : [])
    .filter((turn) => turn?.who === "them" && typeof turn.text === "string")
    .map((turn) => String(turn.text))
    .at(-1) ?? "";

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: (opening && !said ? `${context}\n\n${history}\nThey are waiting. Speak first.` : `${context}\n\n${history}\n${them}${answerNow}`).trim(),
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
  let rejectedRepeat = false;

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
      if (call.name === "add_phrase") {
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
