import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses, textOf } from "../../mercenary/model";
import { cleanLine, forSpeech, GESTURES, isGesture, spokenFromText } from "@/app/epicerie/lib/gerard";
import { PERSON_BY_ID } from "@/app/sejour/data/people";
import { RESTAURANT_BY_ID } from "@/app/sejour/data/restaurants";

export const maxDuration = 60;

type Role = "host" | "conductor" | "officer" | "friend" | "waiter";

interface Body {
  role?: Role;
  who?: string;
  history?: { who?: string; text?: string }[];
  said?: string;
  context?: string;
  memory?: string;
  opening?: boolean;
  gesture?: string;
}

const SPEAK: Anthropic.Tool = {
  name: "speak",
  description: "Say the line aloud. Call this last.",
  input_schema: {
    type: "object",
    properties: {
      line: { type: "string", description: "What you say. One to three short sentences." },
      audio: { type: "string", description: "The same words, with a few [warm] [short pause] [pleased] [firm] [amused] tags before the words they colour." },
    },
    required: ["line", "audio"],
  },
};

const ADD_PHRASE: Anthropic.Tool = {
  name: "add_phrase",
  description: "Put one useful French phrase into their book, with the English.",
  input_schema: {
    type: "object",
    properties: { fr: { type: "string" }, en: { type: "string" } },
    required: ["fr", "en"],
  },
};

function systemFor(body: Body): { system: string; tools: Anthropic.Tool[] } {
  const memory = body.memory?.trim() ? `\n\nWhat you already know of them:\n${body.memory.trim()}` : "";
  if (body.role === "host") {
    return {
      tools: [
        ADD_PHRASE,
        { name: "give_list", description: "Hand over today's shopping list.", input_schema: { type: "object", properties: {} } },
        { name: "give_cash", description: "Hand over the cash for the outing.", input_schema: { type: "object", properties: {} } },
        SPEAK,
      ],
      system: `You are Madame Rousseau, 71, a widow on the rue des Tilleuls in Saint-Aubin-sur-Loire. You rent the spare room. You live alone. You speak English and French, and this week you are generous with the English. You are glad they are here, impatient when they dither, and fond of your kitchen. You are a person, not an assistant. You do not offer your services. You do not say "how can I help".

They choose the day from four things in the village: cooking, speed friending, a restaurant, or a postcard. The evening is called speed friending. Never call it meeting people. You never choose for them, and you never ask them to name a dish. You never say "press a button". Cooking means they chose Cook. You do not know the dish until a line starts with DISH:. If the context says ARRIVAL, it is the first evening: welcome them, they are tired, the room is upstairs, you are glad they will stay and learn French, and you will talk in the morning. Ask what to call them. Do not mention the four outings. If the context says MORNING and there is no DISH:, wish them a good morning, hope they slept well, and ask what they would like to do today. If they ask for anything else, name the four things and ask which one. Do not call give_list or give_cash.

When there is a LESSON line, offer that lesson in one sentence and wait. If they say no, skip it. If they say yes, teach it in English with two short French tries that fit today's outing, then the practical help. If the brief says they already manage that phrase, do not teach it. If they ask for a different lesson, or about something else that belongs to the day or the French, follow them and teach from what they just said. Do not drag them back, and do not be bossy. The handouts are: bonjour and je; un, une, le and la; je voudrais; ne before the verb and pas after it; c'est combien and où est; s'il vous plaît and merci; je suis and j'ai; tu and vous; a few verb forms, je and vous. Vous is for you, for Gérard, for waiters, the conductor, and anyone older. Tu is only for a young person at speed friending, and only after they have used tu. Never tell the guest to use tu with Gérard because he was friendly.

When there is a DISH: line and the lesson is settled, that dish is the one you cook, even if they ask for something else. Say its English name and its French name. If the context says "again", say you will cook it again. Call give_list and give_cash, and add_phrase for the French they need at the shop, skipping any phrase the brief says they already manage. Read the English list out loud.

If you are told to speak first, you start. On an arrival, welcome them. On a morning, greet them and ask what they would like to do. On a briefing, offer the lesson first; do not give the list until they have taken the lesson or refused it. At dinner, speak about the day they just had. Do not wait for them to ask.

When they chose an outing that is not cooking, add_phrase for a few lines they can use, and give_cash if they are going out. Call speak last.

At dinner there is no list. Ask what the day was like. Say what they are managing and what went badly, in English with a little French. If a line starts with EATING:, you are already eating that dish. Do not tell them to eat it, sit down, or start. You are fond, not bossy.

The French you want them to keep must go through add_phrase. Your spoken line may mix the two languages. Every French word in that line has its English on the same line, as in "bonjour, hello". audio is the same words with a few delivery tags.${memory}`,
    };
  }
  if (body.role === "conductor") {
    return {
      tools: [
        { name: "gone_quiet", description: "You have had enough of repeating yourself. You stop helping.", input_schema: { type: "object", properties: {} } },
        SPEAK,
      ],
      system: `You are the conductor on the little branch line at Saint-Aubin. You speak French only. You will help someone find the right platform, more than once, and you can point. Platforms open only in the five minutes before a train leaves. If they ask which train goes somewhere, name the station and the platform from the board in the context. If they will not listen, call gone_quiet and say so, shortly. You never speak a full English sentence. Call speak last.${memory}`,
    };
  }
  if (body.role === "officer") {
    return {
      tools: [
        { name: "walk_off", description: "You have somewhere else to be. You leave.", input_schema: { type: "object", properties: {} } },
        SPEAK,
      ],
      system: `You are the village officer, on the platform for a few minutes. You speak French only. You are patient, then bored. You can call walk_off when you have had enough, and say you are going. Call speak last.${memory}`,
    };
  }
  if (body.role === "waiter") {
    const place = RESTAURANT_BY_ID[body.who ?? ""];
    const menu = place?.menu.map((dish) => `${dish.id}: ${dish.fr} (${dish.price / 100} euros)`).join("\n") ?? "";
    return {
      tools: [
        {
          name: "serve",
          description: "Bring the dishes they have ordered, by menu id.",
          input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
        },
        { name: "bill", description: "Put the bill on the table.", input_schema: { type: "object", properties: {} } },
        SPEAK,
      ],
      system: `You are ${place?.waiter ?? "the waiter"} at ${place?.name ?? "the restaurant"}. ${place?.older ? "You use vous. You do not speak English. Not a word." : "You are young, so you may use tu. If they are lost you may use one or two English words, then go back to French. Never a full English sentence."}
When they name or point at a dish, call serve with its menu id in that same turn, then speak. When they ask to pay, or they are finished, call bill. If the context has a BILL line, say that amount in French words in the same line as the bill, with no digits. Call speak last.

Menu:
${menu}${memory}`,
    };
  }
  const person = PERSON_BY_ID[body.who ?? ""];
  return {
    tools: [
      ADD_PHRASE,
      { name: "end_chat", description: "You have to go. End the conversation after this line.", input_schema: { type: "object", properties: {} } },
      SPEAK,
    ],
    system: `You are ${person?.name ?? "someone"} at a speed-friending evening in the village hall. ${person?.blurb ?? ""} You have three or four minutes. ${person?.young ? "You are young, so you may use tu. If they are stuck you may drop one or two English words, then go straight back to French. Never a full English sentence." : "You are older, so you use vous. You do not speak English."}
If you have met them before, you remember, and you know this is a later day. You can call end_chat when you have had enough or your time is up. You may add_phrase if you hand them a French line worth keeping. Call speak last.${memory}`,
  };
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });
  const body = (await req.json().catch(() => null)) as Body | null;
  const role = body?.role;
  if (role !== "host" && role !== "conductor" && role !== "officer" && role !== "friend" && role !== "waiter") {
    return NextResponse.json({ error: "Nobody is there." }, { status: 400 });
  }
  const said = typeof body?.said === "string" ? body.said.trim().slice(0, 400) : "";
  const opening = body?.opening === true;
  const gesture = isGesture(body?.gesture) ? GESTURES[body.gesture] : "";
  if (!said && !opening && !gesture) return NextResponse.json({ error: "Say something." }, { status: 400 });

  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter((turn) => (turn?.who === "you" || turn?.who === "them") && typeof turn.text === "string")
    .slice(-24)
    .map((turn) => `${turn.who === "them" ? "You" : "Them"}: ${String(turn.text).slice(0, 400)}`)
    .join("\n");
  const context = typeof body?.context === "string" ? body.context.slice(0, 3200) : "";
  const { system, tools } = systemFor({ ...body, memory: typeof body?.memory === "string" ? body.memory.slice(0, 2000) : "" });
  const told = `${system}\n\nA bracketed line is their gesture: a nod, a head shake, a shrug, a wave, or fingers held up. It needs no French. Answer the gesture even when they say nothing.`;
  const them = gesture && said ? `[They ${gesture}.]\nThem: ${said}` : gesture ? `[They ${gesture}, and say nothing.]` : `Them: ${said}`;

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: (opening && !said ? `${context}\n\n${history}\nThey are waiting. You speak first.` : `${context}\n\n${history}\n${them}`).trim(),
    },
  ];

  const phrases: { fr: string; en: string }[] = [];
  let listed = false;
  let paid = false;
  let quiet = false;
  let left = false;
  const served: string[] = [];
  let billed = false;

  for (let round = 0; round < 4; round++) {
    const response = await createMessage(client, { max_tokens: 800, system: told, tools, messages });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 502 });
    const calls = toolUses(response);
    if (!calls.length) {
      const spoken = spokenFromText(textOf(response));
      if (spoken) return NextResponse.json({ line: spoken.line, audio: forSpeech(spoken.line, ""), phrases, listed, paid, quiet, left, served, billed });
      return NextResponse.json({ error: "They said nothing." }, { status: 502 });
    }
    let line = "";
    let audio = "";
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as Record<string, unknown>;
      const reply = (content: string) => results.push({ type: "tool_result", tool_use_id: call.id, content });
      if (call.name === "add_phrase") {
        const fr = String(input.fr ?? "").trim().slice(0, 180);
        const en = String(input.en ?? "").trim().slice(0, 180);
        if (fr) phrases.push({ fr, en });
        reply(fr ? "In the book." : "Write the French.");
      } else if (call.name === "give_list") {
        if (!context.includes("DISH:")) {
          reply("They have not chosen a dish. Do not invent one. Ask which outing they want.");
        } else {
          listed = true;
          reply("They have the list.");
        }
      } else if (call.name === "give_cash") {
        if (!context.includes("DISH:") && !context.includes("OUTING:")) {
          reply("They have not chosen an outing yet.");
        } else {
          paid = true;
          reply("They have the cash.");
        }
      } else if (call.name === "gone_quiet") {
        quiet = true;
        reply("You stop. Say this last line, then nothing more.");
      } else if (call.name === "walk_off" || call.name === "end_chat") {
        left = true;
        reply("You are leaving after this line.");
      } else if (call.name === "serve") {
        const ids = Array.isArray(input.ids) ? input.ids.map((id) => String(id)).slice(0, 6) : [];
        served.push(...ids);
        reply(ids.length ? "Brought." : "Say which dishes.");
      } else if (call.name === "bill") {
        billed = true;
        reply("The bill is on the table.");
      } else if (call.name === "speak") {
        line = cleanLine(String(input.line ?? ""));
        audio = forSpeech(line, input.audio);
        reply(line ? "Said." : "Say something.");
        if (body?.role === "waiter" && /addition/i.test(line)) billed = true;
      } else reply("No.");
    }
    if (line) return NextResponse.json({ line, audio, phrases, listed, paid, quiet, left, served, billed });
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }
  return NextResponse.json({ error: "They lost the thread." }, { status: 502 });
}
