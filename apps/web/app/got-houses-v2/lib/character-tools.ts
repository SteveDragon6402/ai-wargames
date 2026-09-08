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
  HoldRuntime,
  NpcAgentState,
  NpcRuntimePatch,
} from "../types";
import {
  CHARACTER_SEED_MAP,
  capNotepad,
  factionLordId,
  getBackground,
  NPC_CHAT_HARD_MAX_WORDS,
  NPC_CHAT_MAX_WORDS,
} from "../data/characters";
import { HOLDS, HOLDS_MAP } from "../data/holds";
import { getCastleSeed } from "../data/castles";
import { searchAdvice, searchFactionEvents } from "./faction-events";
import { garrisonHeadcount } from "./hold-runtime";

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
  /** Castle garrison / siege runtime */
  holdStates?: Record<string, HoldRuntime>;
  /**
   * Set when this NPC is being asked to answer for a besieged seat. Carries the
   * terms on the table plus a soft read of the position, and collects whatever
   * the castellan decides — a tool call, not prose, so intent is unambiguous.
   */
  surrender?: {
    holdId: string;
    /** Rendered terms text, or null when nothing has been offered. */
    termsText: string | null;
    /** Soft one-line read of food, men, odds and relief. */
    pressure: string;
    /** Filled in by accept_terms / reject_terms / propose_terms. */
    decision: SurrenderDecision | null;
  };
}

export interface ToolLoopResult {
  text: string;
  patches: NpcRuntimePatch[];
  /** Advice recorded during this tool loop (append to GameState.adviceLog) */
  adviceRecords?: AdviceRecord[];
}

function getNpc(ctx: CharacterToolContext): NpcAgentState | null {
  const c = ctx.characters[ctx.actingCharacterId];
  return c?.kind === "npc" ? c : null;
}

/**
 * Which walls this NPC speaks for.
 *
 * Ephemeral castellans carry `holdId`, but a named garrison commander asked to
 * parley usually does not — they were simply left inside when a host peeled off.
 * Falling back to the garrison rosters is what keeps `inspect_my_castle` from
 * failing for exactly the characters the prompt tells to use it.
 */
function postedHoldIdFor(ctx: CharacterToolContext): string | null {
  const me = getNpc(ctx);
  if (!me) return null;
  if (me.holdId) return me.holdId;
  if (ctx.surrender?.holdId) return ctx.surrender.holdId;

  const name = me.name.toLowerCase();
  for (const [holdId, hs] of Object.entries(ctx.holdStates ?? {})) {
    const roster = [
      ...hs.garrison.leaders.map((l) => l.name),
      ...(hs.garrison.notables ?? []).map((n) => n.name),
    ];
    if (roster.some((n) => n.toLowerCase() === name)) return holdId;
    if (hs.castellanId === me.id) return holdId;
  }
  return null;
}

function formatCastleBlock(
  holdId: string,
  hs: HoldRuntime | undefined,
  title?: string
): string {
  const hold = HOLDS_MAP.get(holdId);
  const seed = getCastleSeed(holdId);
  const label = title ?? hold?.name ?? holdId;
  if (!hs) {
    return `Castle state for ${label}: unknown.`;
  }
  const men = garrisonHeadcount(hs.garrison);
  const leaders =
    hs.garrison.leaders.map((l) => l.name).join(", ") || "(none named)";
  const notables =
    (hs.garrison.notables ?? []).map((n) => n.name).join(", ") || "(none)";
  const siege = hs.siege
    ? `UNDER SIEGE — turn ${hs.siege.turns}, besieger ${hs.siege.besiegerFaction}, investing armies: ${hs.siege.armyIds.join(", ")}`
    : "Not under investment.";
  return `Castle ${label} (${seed.siteKind}):
Controller: ${hs.controller ?? "none"} · home: ${hs.homeFaction}
Garrison: ${men.toLocaleString()} / capacity ${seed.capacity.toLocaleString()} (default ${seed.defaultGarrison.toLocaleString()})
Commanders: ${leaders}
Notables: ${notables}
Supplies: ${hs.supplies}
Food days remaining: ${hs.foodDaysRemaining ?? "not tracked"}
${siege}
Post-siege recovery turns: ${hs.postSiegeTurnsLeft}${hs.scar ? ` · Scar: ${hs.scar}` : ""}`;
}

/**
 * The one structural channel for spoken words.
 *
 * Everything else about a reply can be malformed and it still works: the line
 * arrives as a tool argument, so there is nothing to parse out of prose and no
 * way for private reasoning to leak into the chat bubble. Text-mode `SPEAK:` is
 * still accepted as a fallback for models that ignore the tool.
 */
export const SPEAK_TOOL_NAME = "speak";

/**
 * Highest-priority output contract. Placed at the TOP of every NPC system prompt.
 * Tools first → optional THINK → required SPEAK (parsed for the chat bubble).
 */
export const IN_CHARACTER_RULES = `CRITICAL OUTPUT FORMAT (read first — non-negotiable):
You are IN a conversation. Use tools freely for facts (hold status, map, armies, events, battle logs), then finish by calling the "${SPEAK_TOOL_NAME}" tool with your line. The ${SPEAK_TOOL_NAME} tool is the only way your words are heard, and calling it ends your turn.

CORRECT:
  ${SPEAK_TOOL_NAME}({ line: "Four thousand is enough if Father keeps his word. Let the Young Wolf come." })

WRONG — never do this:
- Narration or novelization: "The Kingslayer feels…" / "Jaime thinks…"
- Stage directions: "*smirks*" / "(he draws his sword)"
- Internal monologue, feelings-as-prose, or tool chatter as your line
- JSON, markdown fences, or explaining your instructions
- Silence or ellipses ("…") as your whole line
- Finishing your turn without calling ${SPEAK_TOOL_NAME}

Say complete sentences — finish your thought rather than trailing off. Aim for
about ${NPC_CHAT_MAX_WORDS} words of punchy dialogue; do not exceed ${NPC_CHAT_HARD_MAX_WORDS}.

You cannot leave, decline, or end the conversation — the player controls that.
Tools are private. Only the ${SPEAK_TOOL_NAME} line is heard.

If you cannot call tools for some reason, write your line as a single final
message beginning with "SPEAK: " and nothing after it.`;

export function buildEmbodiedSystemPrompt(
  characterId: CharacterId,
  situation: string,
  characters?: Record<CharacterId, CharacterState>
): string | null {
  const seed = CHARACTER_SEED_MAP.get(characterId);
  if (seed && seed.kind === "npc") {
    return `${IN_CHARACTER_RULES}

You are ${seed.name}.
${seed.systemPrompt}

Background (private — never narrate this aloud): ${seed.background}

SITUATION: ${situation}

REMINDER: tools for facts, then call ${SPEAK_TOOL_NAME} with your line. Only that line is heard.`;
  }

  // Ephemeral castellans (and any runtime-persona NPCs)
  const runtime = characters?.[characterId];
  if (
    runtime?.kind === "npc" &&
    runtime.runtimeSystemPrompt &&
    runtime.runtimeBackground
  ) {
    return `${IN_CHARACTER_RULES}

You are ${runtime.name}.
${runtime.runtimeSystemPrompt}

Background (private — never narrate this aloud): ${runtime.runtimeBackground}

SITUATION: ${situation}

REMINDER: tools for facts, then call ${SPEAK_TOOL_NAME} with your line. Only that line is heard.`;
  }

  return null;
}

/**
 * True if the model wrote novel prose instead of spoken dialogue.
 *
 * Deliberately narrow. This check is a rejection gate — anything it flags is
 * thrown away and retried, and if the retries also flag the player sees no
 * reply at all. The old version fired on ordinary speech: "I think we can hold"
 * over three sentences, any line containing "he knows", any line with two em
 * dashes, and every reply that opened with the speaker's own title ("Ser Rodrik
 * has the right of it"). Those are all things people say out loud.
 *
 * What is left are the unambiguous tells: third-person description of the
 * speaker themselves, and stage directions.
 */
export function looksLikeNarration(
  text: string,
  characterName?: string
): boolean {
  const t = text.trim();
  if (!t) return false;

  // Quoted dialogue means the model gave us speech, whatever surrounds it.
  const quotes = [...t.matchAll(/[""]([^""]+)[""]|'([^']+)'/g)].map(
    (m) => m[1] || m[2] || ""
  );
  if (quotes.join("").length >= Math.min(20, t.length * 0.4)) return false;

  // Stage directions: *smirks*, (he draws his sword)
  if (/^\s*[*(_].{2,60}[*)_]\s*$/.test(t)) return true;

  // The speaker described in the third person — the actual novelization tell.
  if (characterName) {
    const parts = characterName.split(/\s+/).filter(Boolean);
    // Skip honorifics so "Ser Rodrik" matches on "Rodrik".
    const names = parts.filter(
      (p) => !/^(ser|lord|lady|maester|king|queen|prince|princess|the)$/i.test(p)
    );
    for (const name of names) {
      if (name.length < 3) continue;
      const n = escapeReg(name);
      // "Rodrik feels…", "Rodrik's hand tightens", "Rodrik turns away"
      if (
        new RegExp(
          `\\b${n}(?:'s)?\\b\\s+\\w{0,12}\\s?\\b(feels?|felt|thinks?|thought|wonders?|realiz\\w+|realis\\w+|senses?|smiles?|smirks?|nods?|turns?|watches|watched|studies|studied|considers?|pauses?|paused)\\b`,
          "i"
        ).test(t)
      ) {
        return true;
      }
    }
  }

  // "He feels…" / "her jaw tightens" with no first-person voice anywhere.
  const lower = t.toLowerCase();
  const hasFirstPerson = /\b(i|i'm|i'll|we|we'll|my|our|me|us)\b/.test(lower);
  if (
    !hasFirstPerson &&
    /\b(he|she|his|her|him)\b/.test(lower) &&
    /\b(feels?|felt|thinks?|thought|wonders?|realiz\w+|realis\w+|senses?|smiles?|smirks?|nods?|watches|watched|studies|studied)\b/.test(
      lower
    )
  ) {
    return true;
  }

  return false;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSpeakPayload(raw: string): string | null {
  const speakTag = raw.match(/<speak>([\s\S]*?)<\/speak>/i);
  if (speakTag?.[1]?.trim()) return speakTag[1].trim();

  const speakLine = raw.match(/(?:^|\n)\s*SPEAK:\s*([\s\S]*?)\s*$/i);
  if (speakLine?.[1]?.trim()) {
    // Drop any trailing THINK-like noise; SPEAK should be the spoken line(s)
    return speakLine[1]
      .replace(/\n\s*THINK:[\s\S]*$/i, "")
      .replace(/^["'"']|["'"']$/g, "")
      .trim();
  }

  // SPEAK: on its own line mid-block — take from last SPEAK: to end (minus THINK after)
  const lastSpeak = [...raw.matchAll(/(?:^|\n)\s*SPEAK:\s*/gi)].pop();
  if (lastSpeak && lastSpeak.index != null) {
    const after = raw.slice(lastSpeak.index + lastSpeak[0].length).trim();
    const cleaned = after
      .replace(/\n\s*THINK:[\s\S]*$/i, "")
      .replace(/^["'"']|["'"']$/g, "")
      .trim();
    if (cleaned) return cleaned;
  }

  return null;
}

/**
 * Trim only runaway replies, and only at a sentence end.
 *
 * The old version cut at exactly the soft word limit, which is precisely the
 * "they never finish their thought" complaint: a 62-word line lost its last
 * clause. Now the soft limit is prompt guidance, and trimming happens only past
 * a hard ceiling, at the last full stop before it.
 */
function capSpeechWords(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  const words = clean.split(" ").filter(Boolean);
  if (words.length <= NPC_CHAT_HARD_MAX_WORDS) return clean;

  const truncated = words.slice(0, NPC_CHAT_HARD_MAX_WORDS).join(" ");
  const lastStop = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?")
  );
  // Only honour a sentence break if it keeps most of the line.
  if (lastStop > truncated.length * 0.5) return truncated.slice(0, lastStop + 1);
  return `${truncated.replace(/[,;:—-]+$/, "")}…`;
}

/**
 * Strip meta wrappers so only spoken dialogue remains.
 *
 * Idempotent: running it on already-clean text returns that text unchanged, so
 * callers that sanitize a second time cannot mangle a good line. A line that
 * came in through the `speak` tool needs none of this.
 */
export function sanitizeInCharacterReply(
  raw: string,
  characterName?: string
): string {
  let text = raw.trim();
  if (!text) return "";

  // Prefer explicit SPEAK channel
  const spokenMarked = extractSpeakPayload(text);
  if (spokenMarked) {
    text = spokenMarked;
  } else {
    // Prefer a spoken field if the model ignored instructions and returned JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const spoken =
          parsed.speech ?? parsed.reply ?? parsed.line ?? parsed.text;
        if (typeof spoken === "string" && spoken.trim()) {
          text = spoken.trim();
        }
      } catch {
        /* keep raw */
      }
    }

    // Strip THINK: blocks if present without SPEAK
    text = text.replace(/(?:^|\n)\s*THINK:\s*[\s\S]*?(?=(?:\n\s*SPEAK:)|$)/gi, "").trim();
  }

  // If they wrapped real dialogue in quotes inside narration, prefer the quotes
  const quoteChunks = [...text.matchAll(/[""]([^""]{3,})[""]/g)].map((m) =>
    m[1].trim()
  );
  if (quoteChunks.length > 0 && looksLikeNarration(text, characterName)) {
    text = quoteChunks.join(" ");
  }

  // Drop common meta prefixes / wrappers
  text = text
    .replace(/^```[\s\S]*?```/g, "")
    .replace(/^\s*(\*|_){1,2}[^*_\n]+(\*|_){1,2}\s*/gm, "")
    .replace(/^\s*\([^)]*\)\s*/gm, "")
    .replace(/^\s*\[.*?\]\s*/gm, "")
    .replace(
      /^(OOC|Out of character|As [A-Z][a-z]+.*?:|System:|Narrator:|THINK:|SPEAK:)\s*/gim,
      ""
    )
    .replace(/^["'"']|["'"']$/g, "")
    .trim();

  // If multiple paragraphs, keep the first that isn't tool/meta chatter
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length > 1) {
    const spoken = paras.find(
      (p) =>
        !/^(I (used|will use|am using) (the )?tool|Looking at|Checking|Based on|THINK:)/i.test(
          p
        ) && !looksLikeNarration(p, characterName)
    );
    text = spoken ?? paras[0];
  }

  // Collapse leftover newlines into a single spoken beat
  text = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

  // Reject remaining novelization — caller may retry
  if (looksLikeNarration(text, characterName)) {
    return "";
  }

  // Ellipsis-only is not a reply
  if (/^[.…\s]+$/.test(text)) return "";

  return capSpeechWords(text).slice(0, 500);
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
    name: SPEAK_TOOL_NAME,
    description:
      "Say your line out loud. This is the ONLY way your words reach the other person, and it ends your turn. Pass exactly what you say — no narration, no stage directions, no third person, no thoughts.",
    input_schema: {
      type: "object",
      properties: {
        line: {
          type: "string",
          description:
            "The words you speak, first person, in character. A few sentences at most.",
        },
      },
      required: ["line"],
    },
  },
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
            "Optional region filter: north, riverlands, westerlands, crownlands",
        },
      },
      required: [],
    },
  },
  {
    name: "inspect_hold",
    description:
      "Look closely at one hold: seat, region, neighbours, field hosts, garrison, stores, food days, and siege if any.",
    input_schema: {
      type: "object",
      properties: {
        holdName: { type: "string", description: "Hold name, e.g. Riverrun, Moat Cailin" },
      },
      required: ["holdName"],
    },
  },
  {
    name: "inspect_my_castle",
    description:
      "If you are a castellan or posted in a garrison: read your own walls — men, food days, supplies, siege turns, and who invests you. Prefer this before negotiating.",
    input_schema: { type: "object", properties: {}, required: [] },
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
      "Search your faction's action log (marches, rest, fortify, speeches, battles, invest, storm, sally, liberate, claim, abandon, garrison). Not the enemy's private orders. Use freely to gather facts.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword filter (place, army, deed)" },
        kind: {
          type: "string",
          description:
            "Optional: march | rest | fortify | speech | battle | invest | storm | sally | liberate | claim | abandon | garrison | other",
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
    name: "read_terms",
    description:
      "If your seat is under siege: read the terms currently on the table and your own position (food, men, odds, relief). Use before answering any talk of surrender.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "accept_terms",
    description:
      "Yield your seat on the terms offered. The gates open, the castle changes hands, and no battle is fought. Only when you truly mean to give it up.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Short reason you are yielding — for the record.",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "reject_terms",
    description: "Refuse the terms offered. The siege continues.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Short reason for refusing." },
      },
      required: ["reason"],
    },
  },
  {
    name: "propose_terms",
    description:
      "Put your own terms on the table — either a counter to what was offered, or an unprompted offer to yield if your position is hopeless. The other side must still accept.",
    input_schema: {
      type: "object",
      properties: {
        garrisonSpared: {
          type: "boolean",
          description: "Your men march out alive rather than being taken.",
        },
        leadersSpared: {
          type: "boolean",
          description: "You and your captains walk free rather than being held.",
        },
        note: {
          type: "string",
          description: "The terms in your own words, one or two sentences.",
        },
      },
      required: ["garrisonSpared", "leadersSpared", "note"],
    },
  },
];

/** Terms decision a castellan reached during a tool loop. */
export type SurrenderDecision =
  | { kind: "accept"; reason: string }
  | { kind: "reject"; reason: string }
  | {
      kind: "propose";
      garrisonSpared: boolean;
      leadersSpared: boolean;
      note: string;
    };

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
  adviceBag: AdviceRecord[]
): { result: string } {
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
      const hs = ctx.holdStates?.[hold.id];
      const castle = formatCastleBlock(hold.id, hs);
      return {
        result: `${hold.name} — ${hold.region}, seat of House ${hold.house} (${hold.lord}).
Neighbours: ${links}
Ground: ${hold.ground}
Forces present:
${forces}
${castle}`,
      };
    }

    case "inspect_my_castle": {
      const holdId = postedHoldIdFor(ctx);
      if (!holdId) {
        return {
          result:
            "You are not posted as castellan or garrison of a known seat.",
        };
      }
      const hold = HOLDS_MAP.get(holdId);
      const hs = ctx.holdStates?.[holdId];
      return {
        result: formatCastleBlock(holdId, hs, hold?.name ?? holdId),
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
          : c.runtimeBackground || getBackground(c.id) || c.name;
      const army = c.armyId
        ? ctx.armies.find((a) => a.id === c.armyId)
        : undefined;
      const holdPost =
        c.kind === "npc" && c.holdId
          ? HOLDS_MAP.get(c.holdId)?.name
          : undefined;
      const where = army
        ? `Rides with ${army.name} near ${HOLDS_MAP.get(army.holdId)?.name ?? "the host"}.`
        : holdPost
          ? c.kind === "npc" && c.role === "castellan"
            ? `Castellan of ${holdPost}.`
            : `Posted in the garrison at ${holdPost}.`
          : c.alive
            ? "Whereabouts uncertain."
            : "Believed dead or lost.";
      const speciesNote =
        c.kind === "npc" && c.species === "beast"
          ? " (beast — not a speaker of courts)"
          : "";
      return {
        result: `${c.name}${speciesNote} — ${c.kind === "player" ? "lord" : c.role} of the ${c.faction}. ${bg} ${where}`,
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
            return `Turn ${r.turn} at ${holdName}: ${r.holdResult} (${r.defeatType ?? "unclear"})\n${r.narrative.slice(0, 900)}`;
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

    case "read_terms": {
      const s = ctx.surrender;
      if (!s) {
        const holdId = postedHoldIdFor(ctx);
        const hs = holdId ? ctx.holdStates?.[holdId] : undefined;
        if (!hs?.siege) {
          return { result: "No siege, no terms. There is nothing to answer." };
        }
        const t = hs.siege.terms;
        return {
          result:
            t && t.status === "offered"
              ? `Terms on the table from ${t.offeredBy}: ${t.note}`
              : "No terms have been put to you.",
        };
      }
      return {
        result: `${s.termsText ?? "No terms have been put to you — anything you offer is your own."}\n\nYour position: ${s.pressure}`,
      };
    }

    case "accept_terms": {
      if (!ctx.surrender) {
        return { result: "There are no terms before you to accept." };
      }
      const reason = String(input.reason ?? "").trim().slice(0, 240);
      ctx.surrender.decision = { kind: "accept", reason };
      return {
        result:
          "Decision recorded: you yield the seat. Now say the words aloud in SPEAK.",
      };
    }

    case "reject_terms": {
      if (!ctx.surrender) {
        return { result: "There are no terms before you to refuse." };
      }
      const reason = String(input.reason ?? "").trim().slice(0, 240);
      ctx.surrender.decision = { kind: "reject", reason };
      return {
        result:
          "Decision recorded: you refuse. The siege goes on. Now say the words aloud in SPEAK.",
      };
    }

    case "propose_terms": {
      if (!ctx.surrender) {
        return { result: "You are not in a position to put terms." };
      }
      const note = String(input.note ?? "").trim().slice(0, 300);
      if (!note) return { result: "Say what the terms are and try again." };
      ctx.surrender.decision = {
        kind: "propose",
        garrisonSpared: input.garrisonSpared !== false,
        leadersSpared: input.leadersSpared !== false,
        note,
      };
      return {
        result:
          "Terms recorded and put to the other side. Now say them aloud in SPEAK.",
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

    default:
      return { result: `Unknown tool: ${name}` };
  }
}

const CHAT_MODEL = "claude-haiku-4-5";
/** Per-call wall clock. A hung request must not hold the whole turn open. */
const CALL_TIMEOUT_MS = 30_000;

/**
 * Progress from a running agent, so a caller can show something happening
 * instead of a spinner. `line` deltas are the words as they are spoken.
 */
export interface ToolLoopEvents {
  /** Partial spoken words, in order. */
  onLineDelta?: (chunk: string) => void;
  /** A tool the character reached for, by name. */
  onToolUse?: (toolName: string) => void;
}

/** Model call with a hard timeout, SDK backoff, and one manual retry. */
async function callModel(
  client: Anthropic,
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  events?: ToolLoopEvents
): Promise<Anthropic.Messages.Message> {
  const attempt = (maxRetries: number) => {
    // Streaming exists here only to surface the line as it is written; the
    // loop still works off the assembled final message.
    if (!events?.onLineDelta) {
      return client.messages.create(params, {
        timeout: CALL_TIMEOUT_MS,
        maxRetries,
      });
    }
    const stream = client.messages.stream(params, {
      timeout: CALL_TIMEOUT_MS,
      maxRetries,
    });
    let speaking = false;
    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start") {
        speaking =
          event.content_block.type === "tool_use" &&
          event.content_block.name === SPEAK_TOOL_NAME;
        return;
      }
      if (event.type !== "content_block_delta") return;
      const delta = event.delta;
      // The spoken line arrives as JSON fragments of {"line":"…"}; forwarding
      // them raw would leak braces into the bubble, so only the string body
      // between the quotes is passed along.
      if (delta.type === "input_json_delta" && speaking) {
        const words = extractJsonStringFragment(delta.partial_json);
        if (words) events.onLineDelta?.(words);
      }
    });
    return stream.finalMessage();
  };

  try {
    return await attempt(2);
  } catch (err) {
    // One more try on a fresh connection before giving up on this NPC.
    console.warn(
      "[character-tools] model call failed, retrying once:",
      err instanceof Error ? err.message : String(err)
    );
    return attempt(1);
  }
}

/**
 * Pull readable text out of a partial JSON fragment.
 *
 * Fragments arrive mid-token (`{"line": "Aye, my l`), so this strips the
 * scaffolding and unescapes what is left. Anything unparseable is dropped —
 * a missed fragment only costs a little smoothness, since the final message
 * carries the complete line.
 */
function extractJsonStringFragment(partial: string): string {
  let s = partial;
  s = s.replace(/^\s*\{?\s*"?l?i?n?e?"?\s*:?\s*/, "");
  s = s.replace(/^"/, "").replace(/"\s*\}?\s*$/, "");
  if (!s) return "";
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function textOf(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((t) => t.text)
    .join("\n");
}

/**
 * Run the character agent until it has said something.
 *
 * The spoken line comes back through the `speak` tool, so the happy path
 * involves no parsing at all. Text-mode `SPEAK:` is still honoured, and if the
 * model ends its turn without saying anything the line is forced with
 * `tool_choice`, which cannot fail the way "please reply in this format" could.
 */
export async function runCharacterToolLoop(opts: {
  client: Anthropic;
  system: string;
  userMessage: string;
  ctx: CharacterToolContext;
  maxRounds?: number;
  maxTokens?: number;
  /** speech (default): sanitize to spoken line. raw: keep model text (e.g. battle-brief JSON). */
  outputMode?: "speech" | "raw";
  /** Optional progress hooks — set these to stream the line as it is said. */
  events?: ToolLoopEvents;
}): Promise<ToolLoopResult> {
  const { client, system, userMessage, ctx, events } = opts;
  const maxRounds = opts.maxRounds ?? 5;
  const maxTokens = opts.maxTokens ?? 600;
  const outputMode = opts.outputMode ?? "speech";
  const speechMode = outputMode === "speech";
  const characterName = ctx.characters[ctx.actingCharacterId]?.name;

  // Raw callers want their own format back, so the speak channel is not offered
  // to them at all — otherwise a JSON-producing prompt can be answered with a
  // line of dialogue instead.
  const speakTool = CHARACTER_TOOL_DEFS.find((t) => t.name === SPEAK_TOOL_NAME)!;
  const tools = speechMode
    ? CHARACTER_TOOL_DEFS
    : CHARACTER_TOOL_DEFS.filter((t) => t.name !== SPEAK_TOOL_NAME);

  const patches = new Map<string, NpcRuntimePatch>();
  const adviceBag: AdviceRecord[] = [];
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  const done = (text: string): ToolLoopResult => ({
    text,
    patches: [...patches.values()],
    adviceRecords: adviceBag,
  });

  /** Last resort: make the model emit a speak call it cannot refuse. */
  async function forceSpokenLine(): Promise<string> {
    try {
      const forced = await callModel(
        client,
        {
          model: CHAT_MODEL,
          max_tokens: 400,
          system,
          tools: [speakTool],
          tool_choice: { type: "tool", name: SPEAK_TOOL_NAME },
          messages: [
            ...messages,
            {
              role: "user",
              content:
                "You have not spoken yet. Say your line now — call the speak tool with the words you say aloud, in character, first person, finishing your thought.",
            },
          ],
        },
        events
      );
      const call = forced.content.find(
        (b): b is Anthropic.Messages.ToolUseBlock =>
          b.type === "tool_use" && b.name === SPEAK_TOOL_NAME
      );
      const line = call
        ? String((call.input as { line?: unknown }).line ?? "")
        : textOf(forced);
      return capSpeechWords(line.trim());
    } catch (err) {
      console.error(
        "[character-tools] forced speak failed:",
        err instanceof Error ? err.message : String(err)
      );
      return "";
    }
  }

  for (let round = 0; round < maxRounds; round++) {
    const response = await callModel(
      client,
      {
        model: CHAT_MODEL,
        max_tokens: maxTokens,
        system,
        tools,
        messages,
      },
      events
    );

    const toolUses = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUses.length > 0) {
      // Side-effect tools run even when the model spoke in the same turn, so a
      // notepad write or a terms decision is never dropped.
      let spoken: string | null = null;
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        if (tu.name === SPEAK_TOOL_NAME) {
          spoken = capSpeechWords(String(input.line ?? "").trim());
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: "Said.",
          });
          continue;
        }
        events?.onToolUse?.(tu.name);
        const { result } = executeCharacterTool(
          tu.name,
          input,
          ctx,
          patches,
          adviceBag
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      }

      if (spoken) return done(spoken);

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    const rawJoined = textOf(response);

    // Ran out of budget mid-sentence: ask for the rest rather than shipping a
    // half-finished thought or throwing the whole thing away.
    if (response.stop_reason === "max_tokens" && rawJoined.trim()) {
      messages.push({ role: "assistant", content: rawJoined });
      messages.push({
        role: "user",
        content: speechMode
          ? "You were cut off. Say your line in full now by calling the speak tool."
          : "You were cut off. Continue from exactly where you stopped.",
      });
      if (speechMode) {
        const forced = await forceSpokenLine();
        if (forced) return done(forced);
      }
      continue;
    }

    if (!speechMode) return done(rawJoined.trim());

    const text = sanitizeInCharacterReply(rawJoined, characterName);
    if (text) return done(text);

    // Ended its turn saying nothing usable — force the line.
    messages.push({
      role: "assistant",
      content: rawJoined.trim() || "(nothing said)",
    });
    return done(await forceSpokenLine());
  }

  // Tool rounds exhausted without a line.
  if (speechMode) return done(await forceSpokenLine());

  const last = await callModel(client, {
    model: CHAT_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [...messages, { role: "user", content: "Continue." }],
  });
  return done(textOf(last).trim());
}
