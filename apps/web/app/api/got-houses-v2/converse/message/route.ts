import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AdviceRecord,
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  ConversationThread,
  FactionEvent,
  HoldRuntime,
  NpcAgentState,
} from "@/app/got-houses-v2/types";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  type CharacterToolContext,
} from "@/app/got-houses-v2/lib/character-tools";
import {
  describeTerms,
  openTermsAt,
  surrenderPressure,
} from "@/app/got-houses-v2/lib/surrender";

interface MessageBody {
  thread: ConversationThread;
  npcCharacterId: CharacterId;
  playerMessage: string;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  turn?: number;
  factionEvents?: FactionEvent[];
  adviceLog?: AdviceRecord[];
  holdStates?: Record<string, HoldRuntime>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MessageBody;
    const npc = body.characters[body.npcCharacterId];
    if (!npc || npc.kind !== "npc") {
      return NextResponse.json({ error: "NPC required" }, { status: 400 });
    }

    // A parley about a besieged seat is a decision, not just talk: the castellan
    // gets the terms on the table plus a read of their own position, and answers
    // with a tool call so intent is never guessed from prose.
    const parleyHoldId = body.thread.holdId ?? npc.holdId ?? null;
    const parleyHold = parleyHoldId
      ? body.holdStates?.[parleyHoldId]
      : undefined;
    const openTerms = openTermsAt(parleyHold);
    const pressure =
      parleyHoldId && parleyHold
        ? surrenderPressure(parleyHoldId, parleyHold, body.armies)
        : null;
    const surrenderCtx =
      parleyHoldId && parleyHold?.siege
        ? {
            holdId: parleyHoldId,
            termsText: openTerms
              ? `Terms on the table, offered by ${openTerms.offeredBy}: "${openTerms.note}" — under them ${describeTerms(openTerms)}.`
              : null,
            pressure: pressure?.summary ?? "Position unclear.",
            decision: null,
          }
        : undefined;

    const system = buildEmbodiedSystemPrompt(
      npc.id,
      npc.role === "castellan" || surrenderCtx
        ? `Parley at the walls. Stay and answer only with the words you say aloud. You may negotiate — and you may actually decide.${
            surrenderCtx
              ? " If surrender is in question, use read_terms first, then commit with accept_terms, reject_terms, or propose_terms BEFORE you speak. Words alone change nothing; the tool call is the deed. Do not accept unless you truly mean to open the gates."
              : ""
          } You cannot leave or end the talk.`
        : "Private conversation. Someone is speaking to you. Stay and answer only with the words you say aloud. You cannot leave or end the talk.",
      body.characters
    );
    if (!system) {
      return NextResponse.json({ error: "No system prompt" }, { status: 400 });
    }

    const recent = body.thread.messages
      .filter((m) => m.kind !== "turn_break")
      .slice(-8)
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
      inviteFromId: body.thread.inviteFrom,
      factionEvents: body.factionEvents,
      adviceLog: body.adviceLog,
      holdStates: body.holdStates,
      surrender: surrenderCtx,
    };

    const client = new Anthropic({ apiKey });

    // Streamed as newline-delimited JSON: `delta` frames as the line is
    // spoken, `tool` frames while the character looks things up, and one final
    // `done` (or `error`) frame carrying the state changes. Clients that only
    // read the last frame get exactly the old payload.
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
            userMessage: `Private state (never speak this aloud):
mood: ${(npc as NpcAgentState).mood}
${
  surrenderCtx
    ? `\nYour walls (never speak this aloud verbatim):
${surrenderCtx.termsText ?? "No terms have been put to you."}
Position: ${surrenderCtx.pressure}
`
    : ""
}
What has been said:
${recent || "(just begun)"}

They say to you:
${body.playerMessage}

If you give clear counsel, record_advice privately. Before answering questions about relief, stores, the war, or the map, use tools (inspect_my_castle, survey_map, find_forces, search_faction_events, get_battle_logs). Form your own judgment from tool results — do not invent board state.${
        surrenderCtx
          ? "\nIf this exchange turns on yielding the seat, commit with accept_terms / reject_terms / propose_terms before speaking."
          : ""
      }

Then answer them in your own voice.`,
            ctx,
            maxRounds: 6,
            maxTokens: 500,
          });

          // The loop already returns a clean spoken line; sanitizing again
          // here used to be able to reject a perfectly good reply.
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
              surrender:
                surrenderCtx?.decision && parleyHoldId
                  ? { holdId: parleyHoldId, decision: surrenderCtx.decision }
                  : null,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[converse/message]", msg);
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
    console.error("[converse/message]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
