import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Army, ArmyConditionUpdate, NpcRuntimePatch } from "@/app/got-houses/types";
import { HOLDS_MAP } from "@/app/got-houses/data/holds";
import { countWords, SPEECH_MAX_WORDS } from "@/app/got-houses/data/characters";

interface SpeechBody {
  army: Army;
  speech: string;
  speakerName: string;
  commanderId?: string;
  commanderMood?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SpeechBody;
    if (countWords(body.speech) > SPEECH_MAX_WORDS) {
      return NextResponse.json(
        { error: `Speech must be ≤ ${SPEECH_MAX_WORDS} words` },
        { status: 400 }
      );
    }

    const hold = HOLDS_MAP.get(body.army.holdId);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallbackSpeech(body));
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: `You adjudicate an army's reaction to their lord's speech in a Game of Thrones wargame.
The army is LISTENING — this is their action this turn (not a march).
Parse whether the speech implies REST, FORTIFY, or neither (NONE).
Return JSON only:
{
  "reaction": "one short punchy sentence how the host reacts",
  "morale": "updated morale one-liner",
  "tiredness": "updated tiredness one-liner",
  "stance": "updated stance one-liner",
  "impliedOrder": "rest" | "fortify" | "none",
  "commanderMood": "optional mood line for the lead NPC commander if present"
}`,
      messages: [
        {
          role: "user",
          content: `Speaker: ${body.speakerName}
Army: ${body.army.name} at ${hold?.name ?? body.army.holdId}
Ground: ${hold?.ground ?? "unknown"}
Current morale: ${body.army.morale}
Current tiredness: ${body.army.tiredness}
Current stance: ${body.army.stance}
Lead commander mood (if any): ${body.commanderMood ?? "n/a"}

Speech:
"""
${body.speech}
"""`,
        },
      ],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json(fallbackSpeech(body));

    const parsed = JSON.parse(match[0]) as {
      reaction?: string;
      morale?: string;
      tiredness?: string;
      stance?: string;
      impliedOrder?: "rest" | "fortify" | "none";
      commanderMood?: string;
    };

    const condition: ArmyConditionUpdate = {
      armyId: body.army.id,
      morale: parsed.morale ?? body.army.morale,
      tiredness: parsed.tiredness ?? body.army.tiredness,
      stance: parsed.stance ?? body.army.stance,
    };

    const patches: NpcRuntimePatch[] = [];
    if (body.commanderId && parsed.commanderMood) {
      patches.push({ id: body.commanderId, mood: parsed.commanderMood.slice(0, 160) });
    }

    return NextResponse.json({
      reaction: (parsed.reaction ?? "The men listen in silence.").slice(0, 240),
      condition,
      impliedOrder: parsed.impliedOrder ?? "none",
      patches,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/speech]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function fallbackSpeech(body: SpeechBody) {
  const lower = body.speech.toLowerCase();
  let impliedOrder: "rest" | "fortify" | "none" = "none";
  if (/\b(rest|camp|recover|sleep|bivouac)\b/.test(lower)) impliedOrder = "rest";
  else if (/\b(fortify|dig in|entrench|hold fast|defences|defenses)\b/.test(lower)) {
    impliedOrder = "fortify";
  }

  return {
    reaction:
      impliedOrder === "rest"
        ? "The host settles in, heartened by the words."
        : impliedOrder === "fortify"
          ? "Spades come out — the speech turns men to earthworks."
          : "A murmur of assent runs the ranks.",
    condition: {
      armyId: body.army.id,
      morale: "Heartened by their lord's words",
      tiredness: body.army.tiredness,
      stance:
        impliedOrder === "fortify"
          ? "Setting to dig and hold"
          : impliedOrder === "rest"
            ? "Encamped and listening"
            : "Attentive and steadied",
    },
    impliedOrder,
    patches: [] as NpcRuntimePatch[],
  };
}
