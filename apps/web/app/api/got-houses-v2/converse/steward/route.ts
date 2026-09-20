import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AdviceRecord,
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  ConversationThread,
  Deed,
  Faction,
  FactionEvent,
  FactionOrders,
  ForageState,
  HoldRuntime,
  NpcAgentState,
  PrisonerGroup,
  TurnHistory,
  Audience,
} from "@/app/got-houses-v2/types";
import {
  runCharacterToolLoop,
  type CharacterToolContext,
} from "@/app/got-houses-v2/lib/character-tools";
import { getSystemPrompt } from "@/app/got-houses-v2/data/characters";
import {
  STEWARD_ALLOWED_TOOLS,
  isStewardCharacter,
  stewardIdFor,
} from "@/app/got-houses-v2/lib/steward";
import { buildStewardSystemPrompt } from "@/app/got-houses-v2/lib/steward-prompts";

type StewardIntent = "brief" | "chat" | "advice";

interface StewardBody {
  intent: StewardIntent;
  faction: Faction;
  thread: ConversationThread;
  playerMessage?: string;
  digest?: string;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  turn?: number;
  factionEvents?: FactionEvent[];
  adviceLog?: AdviceRecord[];
  holdStates?: Record<string, HoldRuntime>;
  forage?: ForageState;
  prisoners?: PrisonerGroup[];
  deeds?: Deed[];
  turnHistory?: TurnHistory[];
  audiences?: Audience[];
  north?: FactionOrders;
  westerlands?: FactionOrders;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StewardBody;
    const intent: StewardIntent =
      body.intent === "advice" || body.intent === "brief" ? body.intent : "chat";
    const stewardId = stewardIdFor(body.faction);
    const npc = body.characters[stewardId];
    if (!npc || !isStewardCharacter(npc)) {
      return NextResponse.json({ error: "Steward required" }, { status: 400 });
    }

    const seedPrompt = getSystemPrompt(npc.id) ?? npc.runtimeSystemPrompt ?? "";
    const system = buildStewardSystemPrompt({
      faction: body.faction,
      intent,
      name: npc.name,
      seedPrompt,
    });

    const recent = body.thread.messages
      .filter((m) => m.kind !== "turn_break")
      .slice(-10)
      .map((m) => `${m.speakerName}: ${m.text}`)
      .join("\n");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY missing" },
        { status: 500 }
      );
    }

    const ctx: CharacterToolContext = {
      actingCharacterId: npc.id,
      characters: body.characters,
      armies: body.armies,
      battleReports: body.battleReports,
      conversations: body.conversations,
      threadId: body.thread.id,
      turn: body.turn,
      factionEvents: body.factionEvents,
      adviceLog: body.adviceLog,
      holdStates: body.holdStates,
      forage: body.forage,
      prisoners: body.prisoners,
      deeds: body.deeds,
      turnHistory: body.turnHistory,
      audiences: body.audiences,
      factionOrders:
        body.north && body.westerlands
          ? { north: body.north, westerlands: body.westerlands }
          : undefined,
    };

    const digestBlock =
      intent === "brief" && body.digest
        ? `\nPrivate digest (never recite verbatim; speak from it):\n${body.digest}\n`
        : "";

    const theySay =
      intent === "brief"
        ? "Brief me on what stands now."
        : body.playerMessage?.trim() || "Go on.";

    const userMessage = `Private state (never speak this aloud):
mood: ${(npc as NpcAgentState).mood}
${digestBlock}
What has been said:
${recent || "(just begun)"}

They say to you:
${theySay}

Before stating strength, location, last-turn fighting, or distances, use tools. For how the game is played, use explain_rules. For this turn's marches, use inspect_orders. Then answer in your own voice.`;

    const client = new Anthropic({ apiKey });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (frame: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
        };

        try {
          const result = await runCharacterToolLoop({
            client,
            system,
            events: {
              onLineDelta: (chunk) => send({ type: "delta", text: chunk }),
              onToolUse: (toolName) => send({ type: "tool", name: toolName }),
            },
            userMessage,
            ctx,
            maxRounds: intent === "brief" ? 3 : 6,
            maxTokens: intent === "advice" ? 700 : 500,
            allowedTools:
              intent === "brief" ? [] : [...STEWARD_ALLOWED_TOOLS],
          });

          const reply = result.text.trim();
          if (!reply) {
            send({
              type: "error",
              error: `${npc.name} gave no answer — the words never came back. Try again.`,
            });
          } else {
            send({
              type: "done",
              reply,
              patches: result.patches,
              adviceRecords: result.adviceRecords ?? [],
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[converse/steward]", msg);
          send({ type: "error", error: msg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/steward]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
