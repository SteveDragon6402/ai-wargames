import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Faction, GameState } from "@/app/got-houses-v2/types";
import {
  buildCounselBriefing,
  livingBannermen,
  validateProposal,
} from "@/app/got-houses-v2/lib/audience";
import { factionLordId } from "@/app/got-houses-v2/data/characters";
import { forceToolCall, PROPOSE_TOOL } from "@/app/got-houses-v2/lib/audience-model";

interface Body {
  faction: Faction;
  state: GameState;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { faction, state } = body;
    if (faction !== "north" && faction !== "westerlands") {
      return NextResponse.json({ error: "bad faction" }, { status: 400 });
    }
    if (!state?.characters) {
      return NextResponse.json({ error: "missing state" }, { status: 400 });
    }
    if (livingBannermen(state.characters, faction).length === 0) {
      return NextResponse.json({ error: "no speaker" }, { status: 422 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "no key" }, { status: 503 });
    }

    const lordId = factionLordId(faction);
    const briefing = buildCounselBriefing(state, faction);
    const client = new Anthropic({ apiKey });
    const raw = await forceToolCall(
      client,
      PROPOSE_TOOL,
      `You are a lightweight war-game master. Pick ONE standing dilemma for this faction's player lord. It will be asked while they still issue today's marches, so it must remain valid after a day of fighting.

Rules:
- Speaker must be a living same-faction NPC from the list (id exact).
- Addressee must be ${lordId}.
- Prefer a catalog id. Do not invent hosts, holds, or people who are not on the board.
- Do not stake the question on a battle that may be fought today, a captive who may be killed or freed today, or a seat that may fall today.
- This is not a battle and not a chance to take a castle.`,
      briefing
    );
    if (!raw) {
      return NextResponse.json({ error: "no proposal" }, { status: 502 });
    }
    const checked = validateProposal(raw, state, faction);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.reason }, { status: 422 });
    }
    return NextResponse.json({ proposal: checked.proposal });
  } catch (e) {
    console.error("[got-houses-v2/counsel/propose]", e);
    return NextResponse.json({ error: "propose failed" }, { status: 500 });
  }
}
