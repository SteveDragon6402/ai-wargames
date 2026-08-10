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
 * Highest-priority output contract. Placed at the TOP of every NPC system prompt.
 * Tools first → optional THINK → required SPEAK (parsed for the chat bubble).
 */
export const IN_CHARACTER_RULES = `CRITICAL OUTPUT FORMAT (read first — non-negotiable):
You are IN a conversation. Use tools first when you need facts (hold status, map, armies, events, battle logs). Then end your reply in this exact shape:

THINK: (optional, ≤40 words — private; never shown to the player)
SPEAK: (required — the ONLY words that leave your mouth)

CORRECT final reply:
THINK: Check food and who is outside the walls.
SPEAK: Four thousand is enough if Father keeps his word. Let the Young Wolf come.

CORRECT (no think):
SPEAK: Aye, my lord. We hold the ford.

WRONG — never do this:
- Putting thoughts, narration, or tool chatter in SPEAK
- "The Kingslayer feels…" / "Jaime thinks…" (novelization)
- "*smirks*" or "(he draws his sword)" (stage directions)
- Ending without a SPEAK: line
- Silence or ellipses ("…") as your whole SPEAK

FORBIDDEN in SPEAK:
- Third-person narration, internal monologue, feelings-as-prose
- JSON, markdown fences, explaining tools or system instructions

You cannot leave, decline, or end the conversation — the player controls that.
Tools are private. THINK is private. Only SPEAK is heard.
Hard limit on SPEAK: under ${NPC_CHAT_MAX_WORDS} words, punchy dialogue.`;

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

REMINDER: Tools if needed, then THINK (optional) + SPEAK (required). Only SPEAK is heard.`;
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

REMINDER: Tools if needed, then THINK (optional) + SPEAK (required). Only SPEAK is heard.`;
  }

  return null;
}

/** True if the model wrote novel/narration instead of spoken dialogue. */
export function looksLikeNarration(
  text: string,
  characterName?: string
): boolean {
  const t = text.trim();
  if (!t) return false;

  // Prefer quoted dialogue when present
  const quotes = [...t.matchAll(/[""]([^""]+)[""]|'([^']+)'/g)].map(
    (m) => m[1] || m[2] || ""
  );
  const quotedLen = quotes.join("").length;
  if (quotedLen >= Math.min(20, t.length * 0.45)) return false;

  const lower = t.toLowerCase();

  // First-person internal monologue leaking as "speech"
  if (
    /\bi (feel|felt|think|thought|wonder|realize|realise|sense|know|believe|suspect|recall|remember)\b/.test(
      lower
    ) &&
    !/\b(i (feel|think|believe|know) (we|you|they|it|the|this|that|our|your))\b/.test(
      lower
    )
  ) {
    // Allow short spoken idioms like "I think we hold" — reject reflective monologue
    if (
      /\bi (feel|wonder|realize|realise|sense|recall|remember)\b/.test(lower) ||
      (/\bi (think|thought|know|believe|suspect)\b/.test(lower) &&
        t.split(/[.!?]/).length >= 3)
    ) {
      return true;
    }
  }

  // Classic novel tells
  if (
    /\b(feels?|felt|thinks?|thought|knows?|wonders?|remembers?|realizes?|senses?)\b/.test(
      lower
    ) &&
    /\b(his|her|he|she|him|their)\b/.test(lower)
  ) {
    return true;
  }

  // Epithet / title narration openers
  if (
    /^(the\s+)?(kingslayer|young wolf|hand of the king|lord\s+\w+|ser\s+\w+)\b/i.test(
      t
    )
  ) {
    return true;
  }

  if (characterName) {
    const parts = characterName.split(/\s+/).filter(Boolean);
    const first = parts[0] ?? "";
    const last = parts[parts.length - 1] ?? "";
    if (first && new RegExp(`\\b${escapeReg(first)}'s\\b`, "i").test(t)) {
      return true;
    }
    // "Jaime feels…" / "Jaime's four thousand…"
    if (
      first &&
      new RegExp(
        `\\b${escapeReg(first)}\\b.{0,40}\\b(feels?|thinks?|knows?|is |are |has |was )`,
        "i"
      ).test(t)
    ) {
      return true;
    }
    if (
      last &&
      last.length > 2 &&
      new RegExp(`\\b${escapeReg(last)}\\b.{0,20}\\b(feels?|thinks?)`, "i").test(
        t
      )
    ) {
      return true;
    }
  }

  // Long multi-clause prose with em dashes often = internal monologue
  if ((t.match(/—/g) ?? []).length >= 2 && t.split(/[.!?]/).length >= 3) {
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

function capSpeechWords(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= NPC_CHAT_MAX_WORDS) return words.join(" ");
  return words.slice(0, NPC_CHAT_MAX_WORDS).join(" ");
}

/** Strip meta wrappers so only spoken dialogue remains. */
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
      const me = getNpc(ctx);
      const holdId = me?.holdId;
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

/** Run Haiku with tools until a final spoken line. */
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
  const characterName = ctx.characters[ctx.actingCharacterId]?.name;
  const finishText = (raw: string) =>
    outputMode === "raw"
      ? raw.trim()
      : sanitizeInCharacterReply(raw, characterName);

  const patches = new Map<string, NpcRuntimePatch>();
  const adviceBag: AdviceRecord[] = [];

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  const SPEAK_ONLY =
    "STOP. Your last reply was invalid. Reply again with ONLY this format — nothing else:\nSPEAK: <your spoken words, under 60 words, first person dialogue>\nNo THINK. No narration. No tools. One SPEAK line.";

  async function forceSpokenLine(
    prior: Anthropic.Messages.MessageParam[]
  ): Promise<string> {
    const forced = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 140,
      system,
      messages: [
        ...prior,
        {
          role: "user",
          content: SPEAK_ONLY,
        },
      ],
    });
    const forcedRaw = forced.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((t) => t.text)
      .join("\n");
    return finishText(forcedRaw);
  }

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
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    const rawJoined = textBlocks.map((t) => t.text).join("\n");
    let text = finishText(rawJoined);

    // Missing/invalid SPEAK → up to two hard retries
    if (outputMode === "speech" && !text) {
      messages.push({ role: "assistant", content: response.content });
      text = await forceSpokenLine(messages);
      if (!text) {
        messages.push({
          role: "user",
          content: SPEAK_ONLY,
        });
        // Record the failed force turn so the second retry has context
        const second = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 120,
          system,
          messages: [
            ...messages,
            {
              role: "assistant",
              content: rawJoined || "(invalid)",
            },
            {
              role: "user",
              content:
                "AGAIN. Output exactly one line starting with SPEAK: then your spoken words.",
            },
          ],
        });
        const secondRaw = second.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
          .map((t) => t.text)
          .join("\n");
        text = finishText(secondRaw);
      }
    }

    return {
      text,
      patches: [...patches.values()],
      adviceRecords: adviceBag,
    };
  }

  // Exhausted tool rounds — force a spoken line (two attempts)
  let text =
    outputMode === "speech"
      ? await forceSpokenLine(messages)
      : (
          await client.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 140,
            system,
            messages: [
              ...messages,
              { role: "user", content: "Continue." },
            ],
          })
        ).content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
          .map((t) => t.text)
          .join("\n")
          .trim();

  if (outputMode === "speech" && !text) {
    text = await forceSpokenLine([
      ...messages,
      {
        role: "user",
        content:
          "AGAIN. Output exactly one line starting with SPEAK: then your spoken words.",
      },
    ]);
  }

  return {
    text,
    patches: [...patches.values()],
    adviceRecords: adviceBag,
  };
}
