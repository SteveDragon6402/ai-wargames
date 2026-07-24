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
- Hold ground matters: swamp, mountain, desert heat, or storm-lashed coast make rest worse; fertile mild seats and good lodging make rest better
- March route matters: bog causeways, mountain passes, desert roads, and sea crossings tire more than easy kingsroad or fertile Reach lanes
- Homeland vs climate: weigh the army's homeland character against the hold ground and march route. Northmen recover well in cold and suffer badly in Dornish heat; Westermen know hills and mild west-coast country and struggle most in deep desert or endless fen

MORALE — spirit and will to fight:
- Resting armies get a modest morale improvement (smaller than post-battle recovery)
- Home territory rest: better morale gain than neutral territory
- Fortifying armies: steady but not lifted morale (they are working, not relaxing)
- Long marches without rest: morale slowly erodes
- Hostile climate relative to homeland erodes morale; familiar climate heartens it
- Morale changes should be smaller than battle outcomes — this is a peacetime adjustment

STANCE — battle-readiness and tactical posture:
- Resting (especially multiple consecutive turns): troops grow softer, less drilled, less battle-ready. "Relaxed and unready" after 2+ turns
- Fortifying (1 turn): defensive stance developing. 2+ turns: hardened, entrenched, very defensive — mention if the ground itself favours digging in
- Marching (especially toward the enemy): aggressive, alert, purposeful — arrival route can leave them disordered (swamp, pass) or still formed (easy road)
- Just merged armies this turn (turnsSinceMerge = 0): disorganised, chain of command unsettled — describe the heterogeneous state if source conditions are provided (see below)
- Just split this turn (turnsSinceSplit = 0): uncertain, divided, formations still forming
- Long consecutive marches (3+): experienced and battle-hardened but weary

MERGED ARMIES (when "Pre-merge source conditions" is present):
This army was formed by combining two or more forces this turn. Each source army entered the merger with its own tiredness, morale, and stance — those do not vanish the moment they march together. Describe the merged state in terms of its constituent parts rather than flattening them into a single average.
- Example: "Disorganised from the merger — Tywin's veterans remain steady and well-rested while Jaime's battered men are still exhausted and shaken from their ordeal"
- Acknowledge the contrast if it is meaningful; omit it only when both forces were in essentially the same condition
- If one contingent was in noticeably worse shape, that should be visible in the tiredness and morale descriptions

Each description should be one vivid sentence in ASOIAF flavour.

Respond with JSON only:
[{"armyId": "...", "tiredness": "...", "morale": "...", "stance": "..."}]`;

function climateHarshness(army: TirednessRequest["armies"][number]): "harsh" | "fair" | "kind" {
  const text = `${army.holdGround} ${army.marchRoute?.route ?? ""} ${army.homeland}`.toLowerCase();
  const isNorth = army.homeland.toLowerCase().includes("cold");
  const isWest = army.homeland.toLowerCase().includes("hills");
  const desertOrHeat = /desert|dornish|dry heat|fierce heat|sand|sunspear|boneway|prince's pass/.test(text);
  const swampOrFen = /swamp|bog|fen|neck|causeway|fever/.test(text);
  const coldHome = /northern cold|snow|winter|bitter cold|frost/.test(army.holdGround.toLowerCase());
  const mildHills = /hill|mild|west-coast|fertile|reach|good lodging|excellent rest/.test(army.holdGround.toLowerCase());

  if (isNorth && desertOrHeat) return "harsh";
  if (isNorth && coldHome) return "kind";
  if (isWest && desertOrHeat) return "harsh";
  if (isWest && (mildHills || /hill|pass|mining/.test(army.holdGround.toLowerCase()))) return "kind";
  if (swampOrFen && !isNorth) return "harsh";
  if (/excellent rest|superb rest|comfortable rest|good lodging/.test(army.holdGround.toLowerCase())) return "kind";
  return "fair";
}

function fallbackTiredness(armies: TirednessRequest["armies"]): TirednessUpdate[] {
  return armies.map((army) => {
    let tiredness = army.currentTiredness;
    let morale = army.currentMorale;
    let stance = army.currentStance;
    const climate = climateHarshness(army);
    const hardRoute = army.marchRoute
      ? /swamp|bog|pass|desert|mountain|sea|fever|boneway|neck/.test(army.marchRoute.route.toLowerCase())
      : false;

    if (army.stanceOrder === "rest") {
      if (army.territory === "home" && climate !== "harsh") {
        tiredness = climate === "kind"
          ? "Well-rested on familiar ground that suits them"
          : "Well-rested and in good spirits";
        morale = "Heartened by familiar ground and warm fires";
        stance = army.activity.turnsResting >= 2
          ? "Comfortable and unready — too long from the march"
          : "Relaxed but watchful";
      } else if (climate === "harsh") {
        tiredness = "Rested poorly — the ground and climate work against them";
        morale = "Uneasy — rest helps little in country that hates them";
        stance = "Cautious and defensive, unsettled by the land";
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
      if (army.movesSinceRest >= 4 || (hardRoute && climate === "harsh")) {
        tiredness = hardRoute
          ? "Exhausted by a brutal road and country that drains them"
          : "Exhausted and footsore from the long march";
        morale = climate === "harsh"
          ? "Fraying — the land itself seems set against them"
          : "Fraying — the men grumble and feet blister";
        stance = "Weary but experienced, moving on instinct";
      } else if (army.movesSinceRest >= 2 || hardRoute) {
        tiredness = hardRoute
          ? "Weary from a hard march over difficult ground"
          : "Weary from days of marching";
        morale = "Steady under pressure, though tired";
        stance = "Alert and purposeful, eyes forward";
      } else {
        tiredness = "Tired but steady after the march";
        morale = climate === "kind" ? "Focused and ready on ground that suits them" : "Focused and ready";
        stance = "Aggressive and alert — fresh from the road";
      }
    }

    if (army.activity.turnsSinceMerge === 0) {
      if (army.mergedFrom && army.mergedFrom.length >= 2) {
        const [a, b] = army.mergedFrom;
        stance = `Disorganised from the merger — ${a.name}'s contingent remains ${a.tiredness.toLowerCase().split(".")[0]} while ${b.name}'s men are ${b.tiredness.toLowerCase().split(".")[0]}`;
      } else {
        stance = "Disorganised — units still integrating after the merger";
      }
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

        const mergeSection = army.mergedFrom && army.mergedFrom.length > 0
          ? `\nPre-merge source conditions (this army was formed by merging these forces this turn):\n${army.mergedFrom.map((s) => `  • ${s.name}: tiredness="${s.tiredness}", morale="${s.morale}", stance="${s.stance}"`).join("\n")}`
          : "";

        const marchSection = army.marchRoute
          ? `\nMarch this turn: ${army.marchRoute.fromHoldName} → ${army.marchRoute.toHoldName}\nRoute: ${army.marchRoute.route}`
          : "\nMarch this turn: none (held position)";

        return `Army: ${army.name} [id: "${army.armyId}"]
Location: ${army.holdName} (${army.territory} territory)
Hold ground: ${army.holdGround}
Homeland: ${army.homeland}
Commanders: ${leaders}
Strength: ${totalStrength} troops (${unitBreakdown})
Current tiredness: ${army.currentTiredness}
Current morale: ${army.currentMorale}
Current stance: ${army.currentStance}
This turn's order: ${army.stanceOrder} (moves since last rest: ${army.movesSinceRest})${marchSection}
Activity history:
${activityLines}${mergeSection}`;
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
