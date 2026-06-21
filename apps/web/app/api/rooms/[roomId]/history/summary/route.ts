import { and, eq } from "drizzle-orm";
import { gameHistory, getDb } from "@wargame/db";
import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/player";
import Anthropic from "@anthropic-ai/sdk";
import type { TurnEvent } from "@wargame/shared";

function eventsToText(events: TurnEvent[]): string {
  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "move":
        lines.push(`Unit ${e.unitId} moved from ${e.from} to ${e.to}`);
        break;
      case "rout":
        lines.push(`Unit ${e.unitId} routed from ${e.from}${e.to ? ` to ${e.to}` : " (destroyed)"}`);
        break;
      case "node_battle": {
        const winner =
          e.overallWinner === "side1"
            ? e.side1FactionId
            : e.overallWinner === "side2"
              ? e.side2FactionId
              : "neither side";
        lines.push(`Battle at ${e.nodeId}: ${winner} prevailed`);
        for (const o of e.unitOutcomes) {
          lines.push(
            `  - Unit ${o.unitId}: -${o.strengthLossPct}% strength, morale ${o.moraleDelta > 0 ? "+" : ""}${o.moraleDelta}${o.expelled ? " (expelled)" : ""}`
          );
        }
        break;
      }
      case "combat":
        lines.push(`Combat at ${e.nodeId}: ${e.winner} wins`);
        break;
      case "battle_result":
        lines.push(`Battle at ${e.nodeId}: ${e.outcome} — ${e.winnerFactionId ?? "draw"}`);
        break;
      case "dig_in":
        lines.push(`Unit ${e.unitId} dug in at ${e.nodeId}`);
        break;
      case "disengage":
        lines.push(`Disengagement at ${e.nodeId}`);
        break;
      case "morale_change":
        lines.push(`Unit ${e.unitId} morale ${e.delta > 0 ? "+" : ""}${e.delta} → ${e.newMorale}`);
        break;
      case "victory":
        lines.push(`VICTORY: ${e.factionId} wins by ${e.reason}`);
        break;
      case "reinforce":
        lines.push(`Unit ${e.unitId} reinforced at ${e.nodeId}`);
        break;
      case "intercept":
        lines.push(`Intercept fire at ${e.nodeId}: attacker ${e.attackerId} vs ${e.targetId}`);
        break;
    }
  }
  return lines.join("\n");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const player = await getCurrentPlayer(roomId);
  if (!player) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const turnParam = searchParams.get("turn");
  if (!turnParam) {
    return NextResponse.json({ error: "turn required" }, { status: 400 });
  }

  const turn = parseInt(turnParam, 10);
  if (isNaN(turn)) {
    return NextResponse.json({ error: "Invalid turn" }, { status: 400 });
  }

  const db = getDb();
  const [entry] = await db
    .select()
    .from(gameHistory)
    .where(and(eq(gameHistory.roomId, roomId), eq(gameHistory.turn, turn)))
    .limit(1);

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ summary: null });
  }

  const eventText = eventsToText(entry.events as TurnEvent[]);
  if (!eventText.trim()) {
    return NextResponse.json({ summary: "No significant events this turn." });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are a war correspondent reporting on a fantasy wargame set in Middle-Earth (Rohan vs Isengard). 
Write a 2-3 sentence summary of what happened this turn. Be concise, vivid, and factual — no invented details beyond what's listed. 
Use military/tactical language. Do not repeat every unit name.

Turn ${turn} events:
${eventText}

Summary:`,
        },
      ],
    });

    const summary =
      message.content[0]?.type === "text" ? message.content[0].text.trim() : null;
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ summary: null });
  }
}
