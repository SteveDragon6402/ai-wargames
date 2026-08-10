import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  GarrisonConditionContext,
  GarrisonConditionUpdate,
} from "@/app/got-houses/types";

const SYSTEM_PROMPT = `You adjudicate soft condition for castle garrisons in a Game of Thrones wargame.

For each hold, return updated morale, tiredness, and stance — one vivid sentence each (ASOIAF flavour, not hit points).

PHASES:
- siege: Under investment. Wear from hunger, boredom, storm scars, long watches. Food days and siege turns matter. Do not invent field armies.
- scar: Post-siege recovery (few turns). Ease toward strength but leave permanent scar effects in the soft text when warranted — not a pristine reset.
- decade: Long-tail recovery check (every 10th turn). From last known condition and scar history, move toward full strength. If truly recovered, set skipUpdates: true. If scars remain, keep skipUpdates false/omitted and optionally refresh scar.

Respond with JSON only:
[{"holdId":"...","morale":"...","tiredness":"...","stance":"...","skipUpdates":true|false,"scar":"optional string or null"}]`;

function fallback(
  garrisons: GarrisonConditionContext[]
): GarrisonConditionUpdate[] {
  return garrisons.map((g) => {
    if (g.phase === "siege") {
      const starving = g.foodDaysRemaining != null && g.foodDaysRemaining <= 0;
      return {
        holdId: g.holdId,
        morale: starving
          ? "Hollow-eyed and hungry — still holding because the alternative is worse"
          : g.siegeTurns && g.siegeTurns >= 4
            ? "Worn thin by the investment; tempers short on the walls"
            : "Watchful and grim under the siege lines",
        tiredness: starving
          ? "Exhausted from short rations and endless watches"
          : "Tired from wall duty and interrupted sleep",
        stance: "Defensive — clinging to the battlements",
        skipUpdates: false,
      };
    }
    if (g.phase === "scar") {
      return {
        holdId: g.holdId,
        morale: "Recovering — the siege still weighs on their spirits",
        tiredness: "Resting behind repaired gates, not yet whole",
        stance: "Cautious; scarred but rebuilding discipline",
        skipUpdates: false,
        scar: g.scar ?? "Scarred by recent siege.",
      };
    }
    // decade
    const recovered =
      /steady|rested|holding the keep|full strength/i.test(
        `${g.morale} ${g.tiredness} ${g.stance}`
      ) && !g.scar;
    return {
      holdId: g.holdId,
      morale: recovered
        ? "Steady behind the walls"
        : "Quieter now — the worst of the siege fading, scars remain",
      tiredness: recovered
        ? "Rested on garrison duty"
        : "Recovered enough for duty, not for parade",
      stance: recovered
        ? "Holding the keep"
        : "Wary garrison posture — not yet at full ease",
      skipUpdates: recovered,
      scar: recovered ? null : g.scar,
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      turn: number;
      garrisons: GarrisonConditionContext[];
    };
    const garrisons = body.garrisons ?? [];
    if (garrisons.length === 0) {
      return NextResponse.json([] satisfies GarrisonConditionUpdate[]);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallback(garrisons));
    }

    const client = new Anthropic({ apiKey });
    const user = `Turn ${body.turn}. Update these garrisons:\n${JSON.stringify(garrisons, null, 2)}`;

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: user }],
      });
      const text = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((t) => t.text)
        .join("\n")
        .trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return NextResponse.json(fallback(garrisons));
      const parsed = JSON.parse(jsonMatch[0]) as GarrisonConditionUpdate[];
      if (!Array.isArray(parsed)) return NextResponse.json(fallback(garrisons));
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json(fallback(garrisons));
    }
  } catch (err) {
    console.error("garrison-condition error", err);
    return NextResponse.json(
      { error: "garrison-condition failed" },
      { status: 500 }
    );
  }
}
