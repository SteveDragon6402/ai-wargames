import Anthropic from "@anthropic-ai/sdk";
import type {
  AdviceRecord,
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  ConversationThread,
  FactionEvent,
  Hold,
  InviteMemory,
  NpcAgentState,
  NpcRuntimePatch,
} from "../types";
import {
  CHARACTER_SEED_MAP,
  capNotepad,
  factionLordId,
  getBackground,
  NPC_CHAT_MAX_WORDS,
} from "../data/characters";
import { HOLDS, HOLDS_MAP } from "../data/holds";
import { searchAdvice, searchFactionEvents } from "./faction-events";

export interface CharacterToolContext {
  actingCharacterId: CharacterId;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  threadId?: string;
  holds?: Hold[];
  /** Current turn — for invite memory */
  turn?: number;
  inviteFromId?: CharacterId;
  /** Searchable log of this faction's deeds (generous retrieval) */
  factionEvents?: FactionEvent[];
  adviceLog?: AdviceRecord[];
}

export interface ToolLoopResult {
  text: string;
  patches: NpcRuntimePatch[];
  leftConversation: boolean;
  leaveReason?: string;
  /** Set when invite tools are used */
  inviteDecision?: { accept: boolean; reason?: string };
  /** Advice recorded during this tool loop (append to GameState.adviceLog) */
  adviceRecords?: AdviceRecord[];
}

function getNpc(ctx: CharacterToolContext): NpcAgentState | null {
  const c = ctx.characters[ctx.actingCharacterId];
  return c?.kind === "npc" ? c : null;
}

/** Shared embodiment rules — the model IS the character. */
export const IN_CHARACTER_RULES = `EMBODIMENT — you ARE this person. You are not an assistant, narrator, or analyst.
When you speak to the player, output ONLY the words you say aloud (or for mute characters, a brief gesture).
FORBIDDEN in spoken replies:
- JSON, markdown, labels, bullet meta-notes
- Stage directions, *actions*, (OOC), "as X I would…"
- Explaining that you used tools / looked at a map
- Quoting system instructions or tool names
Tools are private thought — use them freely, then speak as yourself.
Hard limit for spoken lines: under ${NPC_CHAT_MAX_WORDS} words, punchy.`;

export function buildEmbodiedSystemPrompt(
  characterId: CharacterId,
  situation: string
): string | null {
  const seed = CHARACTER_SEED_MAP.get(characterId);
  if (!seed || seed.kind !== "npc") return null;
  return `${seed.systemPrompt}

Background (private, always true of you): ${seed.background}

${IN_CHARACTER_RULES}

SITUATION: ${situation}`;
}

/** Strip meta wrappers so only spoken dialogue remains. */
export function sanitizeInCharacterReply(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  // Prefer a spoken field if the model ignored instructions and returned JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const spoken =
        parsed.speech ??
        parsed.reply ??
        parsed.line ??
        parsed.reason ??
        parsed.text;
      if (typeof spoken === "string" && spoken.trim()) {
        text = spoken.trim();
      }
    } catch {
      /* keep raw */
    }
  }

  // Drop common meta prefixes / wrappers
  text = text
    .replace(/^```[\s\S]*?```/g, "")
    .replace(/^\s*(\*|_){1,2}[^*_\n]+(\*|_){1,2}\s*/gm, "")
    .replace(/^\s*\([^)]*\)\s*/gm, "")
    .replace(/^\s*\[.*?\]\s*/gm, "")
    .replace(/^(OOC|Out of character|As [A-Z][a-z]+.*?:|System:|Narrator:)\s*/gim, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  // If multiple paragraphs, keep the first spoken paragraph (avoid trailing analysis)
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length > 1) {
    const spoken = paras.find(
      (p) =>
        !/^(I (used|will use|am using) (the )?tool|Looking at|Checking|Based on)/i.test(
          p
        )
    );
    text = spoken ?? paras[0];
  }

  // Collapse leftover newlines into a single spoken beat
  text = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, 500);
}

function findCharacterByName(
  characters: Record<CharacterId, CharacterState>,
  name: string
): CharacterState | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const exact = Object.values(characters).find(
    (c) => c.name.toLowerCase() === q
  );
  if (exact) return exact;
  return (
    Object.values(characters).find(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        q.includes(c.name.toLowerCase().split(" ")[0] ?? "")
    ) ?? null
  );
}

function findHoldByName(name: string): Hold | undefined {
  const q = name.trim().toLowerCase();
  return (
    HOLDS.find((h) => h.name.toLowerCase() === q) ??
    HOLDS.find((h) => h.name.toLowerCase().includes(q))
  );
}

function armySummary(a: Army): string {
  const hold = HOLDS_MAP.get(a.holdId);
  const leaders = a.leaders.map((l) => l.name).join(", ");
  const strength = a.units.reduce((s, u) => s + u.count, 0);
  return `${a.name} (${a.faction}) — ~${strength} men at ${hold?.name ?? a.holdId}; led by ${leaders || "unknown"}; morale: ${a.morale}; condition: ${a.tiredness}; stance: ${a.stance}`;
}

export const CHARACTER_TOOL_DEFS: Anthropic.Messages.Tool[] = [
  {
    name: "read_notepad",
    description: "Read your private notepad (grudges, promises, judgments). Not spoken aloud.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "write_notepad",
    description: "Replace your notepad. Keep short; excess is trimmed.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "append_notepad",
    description: "Append a short private note.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "update_mood",
    description: "Privately update how you feel (one short line). Not spoken aloud.",
    input_schema: {
      type: "object",
      properties: { mood: { type: "string" } },
      required: ["mood"],
    },
  },
  {
    name: "survey_map",
    description:
      "Look at the realm map: list holds by region with neighbours. Use when you need geography.",
    input_schema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description:
            "Optional region filter: north, vale, riverlands, westerlands, crownlands, stormlands, reach, dorne",
        },
      },
      required: [],
    },
  },
  {
    name: "inspect_hold",
    description:
      "Look closely at one hold: seat, region, neighbours, who is camped there, and the feel of the ground.",
    input_schema: {
      type: "object",
      properties: {
        holdName: { type: "string", description: "Hold name, e.g. Riverrun, Moat Cailin" },
      },
      required: ["holdName"],
    },
  },
  {
    name: "find_forces",
    description:
      "Find armies on the map. Filter by faction and/or name fragment (e.g. 'Bolton', 'Tywin', 'north').",
    input_schema: {
      type: "object",
      properties: {
        faction: { type: "string", description: "north | westerlands | omit for both" },
        query: { type: "string", description: "Optional name fragment" },
      },
      required: [],
    },
  },
  {
    name: "who_is",
    description:
      "Recall who someone is by name (lords, commanders, notables) — their background as you might know it.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "get_battle_logs",
    description: "Recall recent battles that have already been fought.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
      required: [],
    },
  },
  {
    name: "search_faction_events",
    description:
      "Search your faction's action log (marches, rest, fortify, speeches, battles involving your side). Not the enemy's private orders. Use freely to gather facts.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword filter (place, army, deed)" },
        kind: {
          type: "string",
          description: "Optional: march | rest | fortify | speech | battle | other",
        },
        turn: { type: "number", description: "Optional turn number" },
        limit: { type: "number", description: "Max results (default 40, max 80)" },
      },
      required: [],
    },
  },
  {
    name: "search_advice",
    description:
      "Search counsel you (or others) have recorded — advice given to a lord or peer. Separate from your notepad.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        toName: { type: "string", description: "Optional recipient name filter" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "record_advice",
    description:
      "Privately record counsel you have just given (usually to your lord). Short. Not spoken aloud. Use when you give a clear recommendation.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The advice in your own words, brief" },
        toName: {
          type: "string",
          description: "Who you advised (defaults to your faction lord)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "get_recent_messages",
    description: "Recall the last words spoken in this conversation.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
      required: [],
    },
  },
  {
    name: "get_thread_history",
    description: "Recall an older conversation you were part of, by thread id from list_past_threads.",
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
    description: "List conversations you have been in before.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "leave_conversation",
    description:
      "Walk away from this conversation. After calling, speak one final short line only.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "Private reason for your notepad" } },
      required: ["reason"],
    },
  },
  {
    name: "accept_invitation",
    description: "Accept a conversation invitation. Then speak your acceptance aloud as your only text.",
    input_schema: {
      type: "object",
      properties: {
        privateNote: { type: "string", description: "Optional private note" },
      },
      required: [],
    },
  },
  {
    name: "decline_invitation",
    description: "Decline a conversation invitation. Then speak your refusal aloud as your only text.",
    input_schema: {
      type: "object",
      properties: {
        privateNote: { type: "string", description: "Optional private note" },
      },
      required: [],
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
  patches: Map<string, NpcRuntimePatch>,
  inviteDecision: { current?: { accept: boolean; reason?: string } },
  adviceBag: AdviceRecord[]
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
      return { result: "Noted privately." };
    }

    case "append_notepad": {
      const add = String(input.text ?? "").trim();
      const next = capNotepad(
        liveNpc.notepad ? `${liveNpc.notepad}\n${add}` : add
      );
      mutateNpc(patches, npc.id, { notepad: next });
      return { result: "Noted privately." };
    }

    case "update_mood": {
      const mood = String(input.mood ?? "").trim().slice(0, 160);
      mutateNpc(patches, npc.id, { mood });
      return { result: "Mood updated privately." };
    }

    case "survey_map": {
      const region = String(input.region ?? "")
        .trim()
        .toLowerCase();
      const holds = region
        ? HOLDS.filter((h) => h.region === region)
        : HOLDS;
      if (holds.length === 0) return { result: `No holds for region "${region}".` };
      const lines = holds.map((h) => {
        const links = h.links
          .map((id) => HOLDS_MAP.get(id)?.name ?? id)
          .join(", ");
        return `${h.name} (${h.region}, House ${h.house}) — roads to: ${links}`;
      });
      return { result: lines.join("\n") };
    }

    case "inspect_hold": {
      const hold = findHoldByName(String(input.holdName ?? ""));
      if (!hold) return { result: "No such hold that you know." };
      const here = ctx.armies.filter((a) => a.holdId === hold.id);
      const links = hold.links
        .map((id) => HOLDS_MAP.get(id)?.name ?? id)
        .join(", ");
      const forces =
        here.length === 0
          ? "No known hosts camped here."
          : here.map(armySummary).join("\n");
      return {
        result: `${hold.name} — ${hold.region}, seat of House ${hold.house} (${hold.lord}).
Neighbours: ${links}
Ground: ${hold.ground}
Forces present:
${forces}`,
      };
    }

    case "find_forces": {
      const faction = String(input.faction ?? "")
        .trim()
        .toLowerCase();
      const query = String(input.query ?? "")
        .trim()
        .toLowerCase();
      let armies = [...ctx.armies];
      if (faction === "north" || faction === "westerlands") {
        armies = armies.filter((a) => a.faction === faction);
      }
      if (query) {
        armies = armies.filter((a) => {
          const blob = `${a.name} ${a.leaders.map((l) => l.name).join(" ")} ${a.notables?.map((n) => n.name).join(" ") ?? ""}`.toLowerCase();
          return blob.includes(query);
        });
      }
      if (armies.length === 0) return { result: "No matching hosts found." };
      return { result: armies.map(armySummary).join("\n") };
    }

    case "who_is": {
      const c = findCharacterByName(ctx.characters, String(input.name ?? ""));
      if (!c) return { result: "You do not know that name well." };
      const bg =
        c.kind === "player"
          ? c.background
          : getBackground(c.id) || c.name;
      const army = c.armyId
        ? ctx.armies.find((a) => a.id === c.armyId)
        : undefined;
      const where = army
        ? `Rides with ${army.name} near ${HOLDS_MAP.get(army.holdId)?.name ?? "the host"}.`
        : c.alive
          ? "Whereabouts uncertain."
          : "Believed dead or lost.";
      return {
        result: `${c.name} — ${c.kind === "player" ? "lord" : c.role} of the ${c.faction}. ${bg} ${where}`,
      };
    }

    case "search_faction_events": {
      const events = ctx.factionEvents ?? [];
      const hits = searchFactionEvents(events, {
        faction: npc.faction,
        query: String(input.query ?? ""),
        kind: String(input.kind ?? ""),
        turn:
          input.turn != null && input.turn !== ""
            ? Number(input.turn)
            : undefined,
        limit: Number(input.limit) || 40,
      });
      if (hits.length === 0) {
        return { result: "No matching events for your faction." };
      }
      return {
        result: hits
          .map(
            (e) =>
              `[T${e.turn} ${e.kind}] ${e.summary}\n${e.detail.slice(0, 600)}`
          )
          .join("\n---\n"),
      };
    }

    case "search_advice": {
      const advice = ctx.adviceLog ?? [];
      let toId: CharacterId | undefined;
      const toName = String(input.toName ?? "").trim();
      if (toName) {
        const target = findCharacterByName(ctx.characters, toName);
        toId = target?.id;
      }
      const hits = searchAdvice(advice, {
        fromCharacterId: npc.id,
        toCharacterId: toId,
        query: String(input.query ?? ""),
        limit: Number(input.limit) || 30,
      });
      // Also allow reading advice you gave without from filter if empty? Already filtered to fromCharacterId.
      if (hits.length === 0) {
        // Broader: any advice involving this NPC as giver or (if commander) to their lord
        const broader = searchAdvice(advice, {
          query: String(input.query ?? ""),
          toCharacterId: toId,
          limit: Number(input.limit) || 30,
        }).filter(
          (a) =>
            a.fromCharacterId === npc.id || a.toCharacterId === npc.id
        );
        if (broader.length === 0) {
          return { result: "No matching advice records." };
        }
        return {
          result: broader
            .map((a) => {
              const from = ctx.characters[a.fromCharacterId]?.name ?? a.fromCharacterId;
              const to = ctx.characters[a.toCharacterId]?.name ?? a.toCharacterId;
              return `[T${a.turn}] ${from} → ${to}: ${a.text}`;
            })
            .join("\n"),
        };
      }
      return {
        result: hits
          .map((a) => {
            const to = ctx.characters[a.toCharacterId]?.name ?? a.toCharacterId;
            return `[T${a.turn}] You → ${to}: ${a.text}`;
          })
          .join("\n"),
      };
    }

    case "record_advice": {
      const text = String(input.text ?? "").trim().slice(0, 280);
      if (!text) return { result: "Empty advice — not recorded." };
      let toId = factionLordId(npc.faction);
      const toName = String(input.toName ?? "").trim();
      if (toName) {
        const target = findCharacterByName(ctx.characters, toName);
        if (target) toId = target.id;
      }
      const record: AdviceRecord = {
        id: `adv-${Math.random().toString(36).slice(2, 10)}`,
        turn: ctx.turn ?? 0,
        fromCharacterId: npc.id,
        toCharacterId: toId,
        text,
      };
      adviceBag.push(record);
      return {
        result: `Advice recorded privately toward ${ctx.characters[toId]?.name ?? toId}.`,
      };
    }

    case "get_battle_logs": {
      const limit = Math.min(Number(input.limit) || 5, 10);
      const reports = ctx.battleReports.slice(-limit);
      if (reports.length === 0) return { result: "No battles fought yet that you recall." };
      return {
        result: reports
          .map((r) => {
            const holdName = HOLDS_MAP.get(r.holdId)?.name ?? r.holdId;
            return `Turn ${r.turn} at ${holdName}: ${r.holdResult} (${r.defeatType ?? "unclear"})\n${r.narrative.slice(0, 400)}`;
          })
          .join("\n\n"),
      };
    }

    case "get_recent_messages": {
      const limit = Math.min(Number(input.limit) || 8, 20);
      const thread = ctx.conversations.find((t) => t.id === ctx.threadId);
      if (!thread) return { result: "No current conversation." };
      const msgs = thread.messages
        .filter((m) => m.kind !== "turn_break")
        .slice(-limit);
      return {
        result:
          msgs.map((m) => `${m.speakerName}: ${m.text}`).join("\n") ||
          "(silence so far)",
      };
    }

    case "get_thread_history": {
      const threadId = String(input.threadId ?? "");
      const limit = Math.min(Number(input.limit) || 20, 40);
      const thread = ctx.conversations.find((t) => t.id === threadId);
      if (!thread) return { result: "No such conversation." };
      if (!thread.participantIds.includes(npc.id)) {
        return { result: "You were not in that conversation." };
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
      if (mine.length === 0) return { result: "No past conversations." };
      return {
        result: mine
          .map((t) => {
            const others = t.participantIds
              .filter((id) => id !== npc.id)
              .map((id) => ctx.characters[id]?.name ?? id)
              .join(", ");
            return `${t.id} | ${t.kind} | ${t.status} | with ${others || "alone"}${t.closedReason ? ` | ended: ${t.closedReason}` : ""}`;
          })
          .join("\n"),
      };
    }

    case "leave_conversation": {
      const reason = String(input.reason ?? "Left.").slice(0, 120);
      const entry: InviteMemory = {
        fromCharacterId: ctx.inviteFromId ?? ctx.threadId ?? "unknown",
        turn: ctx.turn ?? 0,
        outcome: "left",
        reason,
      };
      const history = [...(liveNpc.inviteHistory ?? []), entry].slice(-12);
      mutateNpc(patches, npc.id, { inviteHistory: history });
      return { result: "You are leaving. Speak one final short line only.", left: true, leaveReason: reason };
    }

    case "accept_invitation":
    case "decline_invitation": {
      const accept = name === "accept_invitation";
      const privateNote = String(input.privateNote ?? "").slice(0, 160);
      inviteDecision.current = { accept, reason: privateNote };
      const entry: InviteMemory = {
        fromCharacterId: ctx.inviteFromId ?? "unknown",
        turn: ctx.turn ?? 0,
        outcome: accept ? "accepted" : "declined",
        reason: privateNote || (accept ? "accepted" : "declined"),
      };
      const history = [...(liveNpc.inviteHistory ?? []), entry].slice(-12);
      mutateNpc(patches, npc.id, { inviteHistory: history });
      if (privateNote) {
        const next = capNotepad(
          liveNpc.notepad
            ? `${liveNpc.notepad}\nInvite: ${privateNote}`
            : `Invite: ${privateNote}`
        );
        mutateNpc(patches, npc.id, { inviteHistory: history, notepad: next });
      }
      return {
        result: accept
          ? "Invitation accepted. Now speak your acceptance aloud — only those words."
          : "Invitation declined. Now speak your refusal aloud — only those words.",
      };
    }

    default:
      return { result: `Unknown tool: ${name}` };
  }
}

/** Run Haiku with tools until a final spoken line (or leave). */
export async function runCharacterToolLoop(opts: {
  client: Anthropic;
  system: string;
  userMessage: string;
  ctx: CharacterToolContext;
  maxRounds?: number;
  maxTokens?: number;
  /** speech (default): sanitize to spoken line. raw: keep model text (e.g. battle-brief JSON). */
  outputMode?: "speech" | "raw";
}): Promise<ToolLoopResult> {
  const { client, system, userMessage, ctx } = opts;
  const maxRounds = opts.maxRounds ?? 5;
  const maxTokens = opts.maxTokens ?? 500;
  const outputMode = opts.outputMode ?? "speech";
  const finishText = (raw: string) =>
    outputMode === "raw" ? raw.trim() : sanitizeInCharacterReply(raw);

  const patches = new Map<string, NpcRuntimePatch>();
  const inviteDecision: { current?: { accept: boolean; reason?: string } } = {};
  const adviceBag: AdviceRecord[] = [];
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

    // Always execute tools when present — never drop them on end_turn
    if (toolUses.length > 0) {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        const { result, left, leaveReason: lr } = executeCharacterTool(
          tu.name,
          input,
          ctx,
          patches,
          inviteDecision,
          adviceBag
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
        const farewell = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 120,
          system,
          messages: [
            ...messages,
            {
              role: "user",
              content:
                "Speak your final line aloud only — the words leaving your mouth. Nothing else.",
            },
          ],
        });
        const raw = farewell.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
          .map((t) => t.text)
          .join("\n");
        return {
          text: finishText(raw) || leaveReason || "Enough.",
          patches: [...patches.values()],
          leftConversation: true,
          leaveReason,
          inviteDecision: inviteDecision.current,
          adviceRecords: adviceBag,
        };
      }
      continue;
    }

    const text = finishText(textBlocks.map((t) => t.text).join("\n"));
    return {
      text,
      patches: [...patches.values()],
      leftConversation,
      leaveReason,
      inviteDecision: inviteDecision.current,
      adviceRecords: adviceBag,
    };
  }

  return {
    text: "",
    patches: [...patches.values()],
    leftConversation,
    leaveReason,
    inviteDecision: inviteDecision.current,
    adviceRecords: adviceBag,
  };
}
