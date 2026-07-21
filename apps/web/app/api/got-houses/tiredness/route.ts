import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { TirednessRequest, TirednessUpdate } from "@/app/got-houses/types";

const SYSTEM_PROMPT = `You are adjudicating the condition and stance of armies in a Game of Thrones strategy game. For each army, provide three short one-line descriptions: tiredness, morale, and stance.

TIREDNESS — physical condition of the troops:
- Resting in home territory: significant recovery
- Resting in neutral territory: modest recovery
- First march: slight fatigue
- 2–3 consecutive marches: moderate fatigue
- 4+ consecutive marches: heavy fatigue, mention exhaustion
- Cavalry-heavy armies tire faster on the march

MORALE — spirit and will to fight:
- Resting armies get a modest morale improvement (smaller than post-battle recovery)
- Home territory rest: better morale gain than neutral territory
- Fortifying armies: steady but not lifted morale (they are working, not relaxing)
- Long marches without rest: morale slowly erodes
- Morale changes should be smaller than battle outcomes — this is a peacetime adjustment

STANCE — battle-readiness and tactical posture:
- Resting (especially multiple consecutive turns): troops grow softer, less drilled, less battle-ready. "Relaxed and unready" after 2+ turns
- Fortifying (1 turn): defensive stance developing. 2+ turns: hardened, entrenched, very defensive
- Marching (especially toward the enemy): aggressive, alert, purposeful
- Just merged armies this turn (turnsSinceMerge = 0): disorganised, chain of command unsettled
- Just split this turn (turnsSinceSplit = 0): uncertain, divided, formations still forming
- Long consecutive marches (3+): experienced and battle-hardened but weary

Each description should be one vivid sentence in ASOIAF flavour.

Respond with JSON only:
[{"armyId": "...", "tiredness": "...", "morale": "...", "stance": "..."}]`;

function fallbackTiredness(armies: TirednessRequest["armies"]): TirednessUpdate[] {
  return armies.map((army) => {
    let tiredness = army.currentTiredness;
    let morale = army.currentMorale;
    let stance = army.currentStance;

    if (army.stanceOrder === "rest") {
      if (army.territory === "home") {
        tiredness = "Well-rested and in good spirits";
        morale = "Heartened by familiar ground and warm fires";
        stance = army.activity.turnsResting >= 2
          ? "Comfortable and unready — too long from the march"
          : "Relaxed but watchful";
      } else {
        tiredness = "Rested but watchful in unfamiliar lands";
        morale = "Steady — the rest does them good even in strange country";
        stance = "Cautious and defensive";
      }
    } else if (army.stanceOrder === "fortify") {
      tiredness = "Tired from digging and construction, but purposefully so";
      morale = "Determined — building defences focuses the men";
      stance = army.activity.turnsFortiying >= 2
        ? "Hardened and entrenched — they know this ground"
        : "Defensive posture taking shape";
    } else {
      if (army.movesSinceRest >= 4) {
        tiredness = "Exhausted and footsore from the long march";
        morale = "Fraying — the men grumble and feet blister";
        stance = "Weary but experienced, moving on instinct";
      } else if (army.movesSinceRest >= 2) {
        tiredness = "Weary from days of marching";
        morale = "Steady under pressure, though tired";
        stance = "Alert and purposeful, eyes forward";
      } else {
        tiredness = "Tired but steady after the march";
        morale = "Focused and ready";
        stance = "Aggressive and alert — fresh from the road";
      }
    }

    if (army.activity.turnsSinceMerge === 0) {
      stance = "Disorganised — units still integrating after the merger";
    } else if (army.activity.turnsSinceSplit === 0) {
      stance = "Uncertain — formations still settling after the split";
    }

    return { armyId: army.armyId, tiredness, morale, stance };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as TirednessRequest;
    const { armies } = body;

    if (!armies || armies.length === 0) {
      return NextResponse.json([]);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[got-houses/tiredness] ANTHROPIC_API_KEY not set — using fallback");
      return NextResponse.json(fallbackTiredness(armies));
    }

    const userMessage = armies
      .map((army) => {
        const totalStrength = army.units.reduce((sum, u) => sum + u.count, 0);
        const unitBreakdown = army.units
          .map((u) => `${u.count} ${u.house} ${u.type}`)
          .join(", ");
        const leaders = army.leaders.map((l) => l.name).join(", ");

        const act = army.activity;
        const activityLines = [
          `Consecutive turns resting: ${act.turnsResting}`,
          `Consecutive turns fortifying: ${act.turnsFortiying}`,
          `Consecutive turns marching: ${act.turnsMarching}`,
          act.turnsSinceMerge !== null ? `Turns since last merge: ${act.turnsSinceMerge} (0 = just merged this turn)` : null,
          act.turnsSinceSplit !== null ? `Turns since last split: ${act.turnsSinceSplit} (0 = just split this turn)` : null,
        ].filter(Boolean).join("\n");

        return `Army: ${army.name} [id: "${army.armyId}"]
Location: ${army.holdName} (${army.territory} territory)
Commanders: ${leaders}
Strength: ${totalStrength} troops (${unitBreakdown})
Current tiredness: ${army.currentTiredness}
Current morale: ${army.currentMorale}
Current stance: ${army.currentStance}
This turn's order: ${army.stanceOrder} (moves since last rest: ${army.movesSinceRest})
Activity history:
${activityLines}`;
      })
      .join("\n\n");

    console.log(`[got-houses/tiredness] Adjudicating ${armies.length} armies`);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");

    console.log("[got-houses/tiredness] Raw response length:", rawText.length);

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[got-houses/tiredness] No JSON array found. Using fallback.");
      return NextResponse.json(fallbackTiredness(armies));
    }

    let parsed: TirednessUpdate[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[got-houses/tiredness] JSON parse error:", msg);
      return NextResponse.json(fallbackTiredness(armies));
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("[got-houses/tiredness] Invalid response format. Using fallback.");
      return NextResponse.json(fallbackTiredness(armies));
    }

    const updates = armies.map((army) => {
      const update = parsed.find((u) => u.armyId === army.armyId);
      return {
        armyId: army.armyId,
        tiredness: update?.tiredness || army.currentTiredness,
        morale: update?.morale || army.currentMorale,
        stance: update?.stance || army.currentStance,
      };
    });

    console.log("[got-houses/tiredness] Success — updated", updates.length, "armies");
    return NextResponse.json(updates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[got-houses/tiredness] Unexpected error:", msg);
    return NextResponse.json(
      { error: "Tiredness adjudication failed", _error: msg },
      { status: 500 }
    );
  }
}
