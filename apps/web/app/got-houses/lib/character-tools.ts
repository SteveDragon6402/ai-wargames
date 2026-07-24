import Anthropic from "@anthropic-ai/sdk";
import type {
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  ConversationThread,
  Hold,
  NpcAgentState,
  NpcRuntimePatch,
} from "../types";
import { capNotepad, getBackground } from "../data/characters";
import { HOLDS_MAP } from "../data/holds";

export interface CharacterToolContext {
  actingCharacterId: CharacterId;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  threadId?: string;
  holds?: Hold[];
}

export interface ToolLoopResult {
  text: string;
  patches: NpcRuntimePatch[];
  leftConversation: boolean;
  leaveReason?: string;
}

function getNpc(ctx: CharacterToolContext): NpcAgentState | null {
  const c = ctx.characters[ctx.actingCharacterId];
  return c?.kind === "npc" ? c : null;
}

export const CHARACTER_TOOL_DEFS: Anthropic.Messages.Tool[] = [
  {
    name: "read_notepad",
    description: "Read your personal notepad (relationship notes, grudges, judgments).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "write_notepad",
    description: "Replace your notepad entirely. Keep it short; excess is trimmed.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "append_notepad",
    description: "Append a short note to your notepad.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "update_mood",
    description: "Set your current mood as one short qualitative line.",
    input_schema: {
      type: "object",
      properties: { mood: { type: "string" } },
      required: ["mood"],
    },
  },
  {
    name: "get_character_background",
    description: "Read another character's fixed background (including player lords).",
    input_schema: {
      type: "object",
      properties: { characterId: { type: "string" } },
      required: ["characterId"],
    },
  },
  {
    name: "get_battlefield_overview",
    description: "Overview of army positions, conditions, and hold ground.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_battle_logs",
    description: "Recent battle reports (narratives and results).",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
      required: [],
    },
  },
  {
    name: "get_recent_messages",
    description: "Last messages in the current conversation thread.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
      required: [],
    },
  },
  {
    name: "get_thread_history",
    description: "Older messages from a thread by id.",
    input_schema: {
      type: "object",
      properties: {
        threadId: { type: "string" },
        limit: { type: "number" },
      },
      required: ["threadId"],
    },
  },
  {
    name: "list_past_threads",
    description: "List conversation threads you participated in.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "leave_conversation",
    description: "Leave the current conversation (anger, boredom, insult, etc.).",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

function mutateNpc(
  patches: Map<string, NpcRuntimePatch>,
  id: CharacterId,
  partial: Partial<NpcRuntimePatch>
) {
  const prev = patches.get(id) ?? { id };
  patches.set(id, { ...prev, ...partial, id });
}

export function executeCharacterTool(
  name: string,
  input: Record<string, unknown>,
  ctx: CharacterToolContext,
  patches: Map<string, NpcRuntimePatch>
): { result: string; left?: boolean; leaveReason?: string } {
  const npc = getNpc(ctx);
  if (!npc) return { result: "Error: only NPC agents may use tools." };

  const liveNpc = {
    ...npc,
    ...(patches.get(npc.id) ?? {}),
  } as NpcAgentState;

  switch (name) {
    case "read_notepad":
      return { result: liveNpc.notepad || "(empty)" };

    case "write_notepad": {
      const text = capNotepad(String(input.text ?? ""));
      mutateNpc(patches, npc.id, { notepad: text });
      return { result: "Notepad replaced." };
    }

    case "append_notepad": {
      const add = String(input.text ?? "").trim();
      const next = capNotepad(
        liveNpc.notepad ? `${liveNpc.notepad}\n${add}` : add
      );
      mutateNpc(patches, npc.id, { notepad: next });
      return { result: "Notepad updated." };
    }

    case "update_mood": {
      const mood = String(input.mood ?? "").trim().slice(0, 160);
      mutateNpc(patches, npc.id, { mood });
      return { result: `Mood set: ${mood}` };
    }

    case "get_character_background": {
      const id = String(input.characterId ?? "");
      const c = ctx.characters[id];
      if (!c) return { result: "Unknown character." };
      const bg = c.kind === "player" ? c.background : getBackground(id) || c.name;
      return {
        result: `${c.name} (${c.kind}, ${c.faction}): ${bg}`,
      };
    }

    case "get_battlefield_overview": {
      const lines = ctx.armies.map((a) => {
        const hold = HOLDS_MAP.get(a.holdId);
        return `- ${a.name} [${a.faction}] at ${hold?.name ?? a.holdId}: morale="${a.morale}"; tiredness="${a.tiredness}"; stance="${a.stance}"; ground="${hold?.ground ?? "?"}"`;
      });
      return { result: lines.join("\n") || "No armies." };
    }

    case "get_battle_logs": {
      const limit = Math.min(Number(input.limit) || 5, 10);
      const reports = ctx.battleReports.slice(-limit);
      if (reports.length === 0) return { result: "No battles yet." };
      return {
        result: reports
          .map(
            (r) =>
              `Turn ${r.turn} @ ${r.holdId}: ${r.holdResult} (${r.defeatType ?? "?"})\n${r.narrative.slice(0, 500)}`
          )
          .join("\n\n"),
      };
    }

    case "get_recent_messages": {
      const limit = Math.min(Number(input.limit) || 8, 20);
      const thread = ctx.conversations.find((t) => t.id === ctx.threadId);
      if (!thread) return { result: "No current thread." };
      const msgs = thread.messages.slice(-limit);
      return {
        result: msgs
          .map((m) => `${m.speakerName}: ${m.text}`)
          .join("\n") || "(no messages)",
      };
    }

    case "get_thread_history": {
      const threadId = String(input.threadId ?? "");
      const limit = Math.min(Number(input.limit) || 20, 40);
      const thread = ctx.conversations.find((t) => t.id === threadId);
      if (!thread) return { result: "Thread not found." };
      if (!thread.participantIds.includes(npc.id)) {
        return { result: "You were not in that thread." };
      }
      return {
        result: thread.messages
          .slice(-limit)
          .map((m) => `${m.speakerName}: ${m.text}`)
          .join("\n"),
      };
    }

    case "list_past_threads": {
      const mine = ctx.conversations.filter((t) =>
        t.participantIds.includes(npc.id)
      );
      if (mine.length === 0) return { result: "No past threads." };
      return {
        result: mine
          .map(
            (t) =>
              `${t.id} | ${t.kind} | ${t.status} | with ${t.participantIds.join(",")}${t.closedReason ? ` | ${t.closedReason}` : ""}`
          )
          .join("\n"),
      };
    }

    case "leave_conversation": {
      const reason = String(input.reason ?? "Left.").slice(0, 120);
      const history = [
        ...(liveNpc.inviteHistory ?? []),
        {
          fromCharacterId: ctx.threadId ?? "unknown",
          turn: 0,
          outcome: "left" as const,
          reason,
        },
      ].slice(-12);
      mutateNpc(patches, npc.id, { inviteHistory: history });
      return { result: `Leaving: ${reason}`, left: true, leaveReason: reason };
    }

    default:
      return { result: `Unknown tool: ${name}` };
  }
}

/** Run Haiku with tools until a final text answer (or leave). */
export async function runCharacterToolLoop(opts: {
  client: Anthropic;
  system: string;
  userMessage: string;
  ctx: CharacterToolContext;
  maxRounds?: number;
  maxTokens?: number;
}): Promise<ToolLoopResult> {
  const { client, system, userMessage, ctx } = opts;
  const maxRounds = opts.maxRounds ?? 4;
  const maxTokens = opts.maxTokens ?? 400;

  const patches = new Map<string, NpcRuntimePatch>();
  let leftConversation = false;
  let leaveReason: string | undefined;

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let round = 0; round < maxRounds; round++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      system,
      tools: CHARACTER_TOOL_DEFS,
      messages,
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );
    const textBlocks = response.content.filter(
      (b): b is Anthropic.Messages.TextBlock => b.type === "text"
    );

    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      const text = textBlocks.map((t) => t.text).join("\n").trim();
      return {
        text,
        patches: [...patches.values()],
        leftConversation,
        leaveReason,
      };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = (tu.input ?? {}) as Record<string, unknown>;
      const { result, left, leaveReason: lr } = executeCharacterTool(
        tu.name,
        input,
        ctx,
        patches
      );
      if (left) {
        leftConversation = true;
        leaveReason = lr;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: result,
      });
    }
    messages.push({ role: "user", content: toolResults });

    if (leftConversation) {
      // One more turn to let them say goodbye, then stop
      const farewell = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 120,
        system,
        messages: [
          ...messages,
          {
            role: "user",
            content: "You are leaving. Give a final short line (under 40 words), then stop.",
          },
        ],
      });
      const text = farewell.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((t) => t.text)
        .join("\n")
        .trim();
      return {
        text: text || leaveReason || "I am done here.",
        patches: [...patches.values()],
        leftConversation: true,
        leaveReason,
      };
    }
  }

  return {
    text: "",
    patches: [...patches.values()],
    leftConversation,
    leaveReason,
  };
}
