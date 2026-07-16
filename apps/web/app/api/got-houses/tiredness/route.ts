import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { TirednessRequest, TirednessUpdate } from "@/app/got-houses/types";

const SYSTEM_PROMPT = `You are adjudicating army tiredness for a Game of Thrones strategy game. For each army, provide a single one-line tiredness description (similar to "Well-rested and eager" or "Weary but determined").

Consider these factors:
- Army composition: Cavalry tire faster on forced marches; large armies move slower
- Move type: "rest" means no movement this turn (recovering); "march" means they moved
- Moves since rest: Consecutive marches accumulate fatigue (1 march = slight fatigue, 3+ marches = significant fatigue)
- Territory: "home" means commanders from this house's lands (familiar, morale boost); "neutral" is unfamiliar ground

Guidelines:
- Resting in home territory: improves tiredness significantly
- Resting in neutral territory: modest recovery
- First march: slight fatigue
- 2-3 consecutive marches: moderate fatigue, mention weariness
- 4+ consecutive marches: heavy fatigue, mention exhaustion or strain
- Cavalry-heavy armies tire faster when marching
- Large infantry armies should reflect their slower, grinding nature

Keep descriptions flavorful and thematic to ASOIAF. Respond with JSON only: [{"armyId": "...", "tiredness": "..."}]`;

function fallbackTiredness(armies: TirednessRequest["armies"]): TirednessUpdate[] {
  return armies.map((army) => {
    let description = army.currentTiredness;
    
    if (army.moveType === "rest") {
      if (army.territory === "home") {
        description = "Well-rested and in good spirits";
      } else {
        description = "Rested but watchful in unfamiliar lands";
      }
    } else {
      if (army.movesSinceRest >= 4) {
        description = "Exhausted and footsore from the long march";
      } else if (army.movesSinceRest >= 2) {
        description = "Weary from days of marching";
      } else {
        description = "Tired but steady after the march";
      }
    }
    
    return { armyId: army.armyId, tiredness: description };
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
        
        return `Army: ${army.name} [id: "${army.armyId}"]
Location: ${army.holdName} (${army.territory} territory)
Commanders: ${leaders}
Strength: ${totalStrength} troops (${unitBreakdown})
Current tiredness: ${army.currentTiredness}
This turn: ${army.moveType} (moves since last rest: ${army.movesSinceRest})`;
      })
      .join("\n\n");

    console.log(`[got-houses/tiredness] Adjudicating ${armies.length} armies`);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
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
