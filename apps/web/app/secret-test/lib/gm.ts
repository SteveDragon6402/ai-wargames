import Anthropic from "@anthropic-ai/sdk";
import type { FactionId, SecretTestState } from "../types";
import { GM_MAX_TOKENS, MAX_BRIEFING_WORDS, SCRATCHPAD_MAX_CHARS } from "../types";
import { archiveCurrentTurn, isOpeningResolve } from "./state";
import { wordCount } from "./words";

const SYSTEM_PROMPT = `You are the hidden game-master of a Wars of the Roses correspondence game, England, 1455. You simulate the whole realm. There is no board.

TRUTH vs DISPATCH
- Scratchpad = the true world. Players never see it. Be unafraid of it: rewrite the entire ledger every turn. Dense. Named. Numbered.
- Briefings = what that house actually knows this turn. Short, factual, direct. Asymmetric: rumours, delays, gaps. Never dump the true map into both letters. Never quote the other house's orders.

SCRATCHPAD — use it fully, every turn
Rewrite the whole thing. Do not append a one-liner. Include at least:
- Crown: who holds power at court, king's health, queen, protector
- Money: treasuries in £, debts, customs, who is unpaid and by how many weeks
- Forces: named hosts, headcount, location, condition, commander
- Ground: who holds which castle/town; garrisons (numbers)
- Diplomacy: marriages, indentures, the Church, Calais, Burgundy, Scotland
- Secrets: plots the other side does not know
- Last season: what actually happened when both orders resolved (casualties, money spent, who moved)
Invent consistent figures and keep them. If York spends 800 marks, subtract it. If 400 men fall at St Albans, the next scratchpad shows 400 fewer.

BRIEFINGS — short, then stop
- Hard cap: under 180 words each. Prefer 80–140.
- Facts and figures the recipient would have: "2,000 under Salisbury at Middleham"; "Calais owed 14 weeks' pay"; "Somerset holds the Tower".
- Direct. No atmosphere, no biblical cadence, no "the realm groans", no wax-and-roses prose.
- Structure: (1) what happened that you would know (2) your present strength/purse/friends as you know them (3) one or two live choices. Then stop.
- Address the house, not "Player 1". Period names. No game-UI talk.

TOOLS
Always update_scratchpad first (full rewrite). Then issue_briefings, or declare_winner if the war is actually decided.
Do not declare a winner on the opening turn, or after one exchange, unless a house is extinguished or the crown is unopposed.
After player orders, briefings are the NEXT turn: only what followed, as each house would learn it.

WINNER (declare_winner only)
- reason: a short factual verdict (what settled it — field, purse, parliament, murder). Under 120 words.
- breakdowns: how each player actually played (secrecy, money, force, delay). Tight, specific, a few short paragraphs. No panegyric.

HOUSES (unless the scratchpad has already moved them)
- Lancaster: Henry VI, Margaret of Anjou, Beaufort/Tudor affinities.
- York: Richard, Duke of York, his sons, Warwick, Calais, the marcher lords.
Players direct the house; keep identities consistent in the scratchpad.`;

export const GM_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "update_scratchpad",
    description:
      "Replace the entire private ledger of the true world. Players never see this. Be dense and specific: £, headcounts, castle holders, unpaid weeks, secrets. Full rewrite every turn — do not write a timid summary.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "issue_briefings",
    description:
      "Private dispatch to each house. Under 180 words each, prefer 80–140. Facts, names, figures only. No atmosphere. After player orders these are the NEXT turn.",
    input_schema: {
      type: "object",
      properties: {
        lancaster: { type: "string" },
        york: { type: "string" },
      },
      required: ["lancaster", "york"],
    },
  },
  {
    name: "declare_winner",
    description:
      "End the war when it is actually decided. Short factual reason. Tight personality notes on how each player conducted the war.",
    input_schema: {
      type: "object",
      properties: {
        winner: { type: "string", enum: ["lancaster", "york"] },
        reason: { type: "string" },
        lancasterBreakdown: { type: "string" },
        yorkBreakdown: { type: "string" },
      },
      required: ["winner", "reason", "lancasterBreakdown", "yorkBreakdown"],
    },
  },
];

function trimScratchpad(text: string): string {
  if (text.length <= SCRATCHPAD_MAX_CHARS) return text;
  return text.slice(0, SCRATCHPAD_MAX_CHARS);
}

function houseName(players: { factionId: string; displayName: string }[], faction: FactionId): string {
  return players.find((p) => p.factionId === faction)?.displayName ?? faction;
}

function formatHistory(state: SecretTestState): string {
  if (state.history.length === 0) return "(none yet)";
  return state.history
    .map((entry) => {
      return [
        `—— TURN ${entry.turn} ——`,
        `LANCASTER BRIEFING:\n${entry.briefings.lancaster}`,
        `YORK BRIEFING:\n${entry.briefings.york}`,
        `LANCASTER ORDERS:\n${entry.actions.lancaster}`,
        `YORK ORDERS:\n${entry.actions.york}`,
      ].join("\n\n");
    })
    .join("\n\n");
}

export function buildGmUserMessage(
  state: SecretTestState,
  players: { factionId: string; displayName: string }[]
): string {
  const lanc = houseName(players, "lancaster");
  const york = houseName(players, "york");
  const opening = isOpeningResolve(state);

  if (opening) {
    return `OPENING OF THE WAR — England, 1455.

Lancaster commander: ${lanc}
York commander: ${york}

No orders yet. No history.

YOUR SCRATCHPAD:
${state.scratchpad || "(empty)"}

First: update_scratchpad with a full starting ledger (crown, money in £, named hosts with headcounts, who holds which castle, secrets). Do not be brief on the pad.
Then: issue_briefings for Turn 1 — under 180 words each, facts only.`;
  }

  return `TURN ${state.turn} RESOLVE

Lancaster commander: ${lanc}
York commander: ${york}

Adjudicate both orders against the scratchpad. Then rewrite the entire scratchpad with what is now true (numbers must move). Then issue_briefings for the NEXT turn (under 180 words, facts each house would know) or declare_winner.

=== BRIEFINGS YOU ISSUED (Turn ${state.turn}) ===

LANCASTER:
${state.briefings.lancaster}

YORK:
${state.briefings.york}

=== PLAYER ORDERS (Turn ${state.turn}) ===

LANCASTER:
${state.pendingActions.lancaster ?? "(none)"}

YORK:
${state.pendingActions.york ?? "(none)"}

=== COMPLETE HISTORY ===
${formatHistory(state)}

=== YOUR SCRATCHPAD ===
${state.scratchpad || "(empty)"}`;
}

function fallbackBriefings(opening: boolean): Record<FactionId, string> {
  if (opening) {
    return {
      lancaster:
        "Henry is unfit to rule; Margaret and Somerset hold the council. The Exchequer can cover about £12,000 this term; Calais is 12 weeks in arrears. York has been named as a possible protector in the Commons rumour. Somerset still holds the Tower. Decide: pay Calais, arrest York, or call a great council.",
      york:
        "You have the protectorate claim and Warwick's indenture. About 3,000 can be put in the field from the marches in six weeks if you spend the wool money. London is split. Somerset holds the Tower and the king's ear. Calais looks to you if you can find their pay. Decide: come to London in arms, bid for parliament, or wait.",
    };
  }
  return {
    lancaster:
      "Your last orders went out. Returns are incomplete. Treasury and hosts are as you last knew them; the other rose moved. Send the next instruction.",
    york:
      "Your last orders went out. Returns are incomplete. Treasury and hosts are as you last knew them; the other rose moved. Send the next instruction.",
  };
}

function applyToolInput(
  name: string,
  input: Record<string, unknown>,
  acc: {
    scratchpad: string;
    briefings?: Record<FactionId, string>;
    winner?: SecretTestState["winner"];
  }
): string {
  if (name === "update_scratchpad") {
    const text = typeof input.text === "string" ? input.text : "";
    acc.scratchpad = trimScratchpad(text);
    return `Scratchpad stored (${acc.scratchpad.length} characters).`;
  }
  if (name === "issue_briefings") {
    const lancaster = typeof input.lancaster === "string" ? input.lancaster.trim() : "";
    const york = typeof input.york === "string" ? input.york.trim() : "";
    if (!lancaster || !york) return "Both lancaster and york briefings are required.";
    if (!acc.scratchpad.trim()) {
      return "Scratchpad is empty. update_scratchpad with the full true ledger first, then issue_briefings.";
    }
    const lw = wordCount(lancaster);
    const yw = wordCount(york);
    if (lw > MAX_BRIEFING_WORDS || yw > MAX_BRIEFING_WORDS) {
      return `Too long (Lancaster ${lw} words, York ${yw}). Each briefing must be under ${MAX_BRIEFING_WORDS} words. Cut atmosphere; keep names, figures, choices.`;
    }
    acc.briefings = { lancaster, york };
    return "Briefings accepted.";
  }
  if (name === "declare_winner") {
    const winner = input.winner === "york" ? "york" : input.winner === "lancaster" ? "lancaster" : null;
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    const lancasterBreakdown =
      typeof input.lancasterBreakdown === "string" ? input.lancasterBreakdown.trim() : "";
    const yorkBreakdown = typeof input.yorkBreakdown === "string" ? input.yorkBreakdown.trim() : "";
    if (!winner || !reason || !lancasterBreakdown || !yorkBreakdown) {
      return "winner, reason, lancasterBreakdown, and yorkBreakdown are all required.";
    }
    acc.winner = {
      factionId: winner,
      reason,
      breakdowns: { lancaster: lancasterBreakdown, york: yorkBreakdown },
    };
    return "Winner recorded. The war ends.";
  }
  return `Unknown tool: ${name}`;
}

function gmModel(): string {
  return process.env.MODEL_GM?.trim() || "claude-sonnet-4-6";
}

function applyOutcome(state: SecretTestState, acc: {
  scratchpad: string;
  briefings?: Record<FactionId, string>;
  winner?: SecretTestState["winner"];
}): SecretTestState {
  const opening = isOpeningResolve(state);
  const next: SecretTestState = {
    ...state,
    scratchpad: acc.scratchpad,
    gmLock: false,
    gmLockAt: undefined,
  };

  if (acc.winner) {
    if (!opening) {
      next.history = [...state.history, archiveCurrentTurn(state)];
    }
    next.winner = acc.winner;
    next.phase = "ended";
    next.pendingActions = {};
    return next;
  }

  const briefings = acc.briefings ?? fallbackBriefings(opening);
  if (opening) {
    next.briefings = briefings;
    next.phase = "awaiting_actions";
    next.pendingActions = {};
    next.turn = 1;
    return next;
  }

  next.history = [...state.history, archiveCurrentTurn(state)];
  next.briefings = briefings;
  next.pendingActions = {};
  next.turn = state.turn + 1;
  next.phase = "awaiting_actions";
  return next;
}

export async function runGmTurn(
  state: SecretTestState,
  players: { factionId: string; displayName: string }[]
): Promise<SecretTestState> {
  const opening = isOpeningResolve(state);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[secret-test/gm] ANTHROPIC_API_KEY missing — fallback briefings");
    return applyOutcome(state, {
      scratchpad: state.scratchpad || "Key missing. Fallback opening of 1455.",
      briefings: fallbackBriefings(opening),
    });
  }

  const client = new Anthropic({ apiKey });
  const model = gmModel();
  const userMessage = buildGmUserMessage(state, players);
  const acc: {
    scratchpad: string;
    briefings?: Record<FactionId, string>;
    winner?: SecretTestState["winner"];
  } = { scratchpad: state.scratchpad };

  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: userMessage }];
  const maxRounds = 8;

  try {
    for (let round = 0; round < maxRounds; round++) {
      const nudge =
        round > 0 && !acc.briefings && !acc.winner
          ? "Call issue_briefings (under 180 words, facts) or declare_winner. If the scratchpad is thin, update_scratchpad with the full ledger first."
          : null;
      if (nudge) {
        messages.push({ role: "user", content: nudge });
      }

      const response = await client.messages.create({
        model,
        max_tokens: GM_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: GM_TOOLS,
        tool_choice: { type: "auto" },
        messages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...( { thinking: { type: "disabled" } } as any),
      });

      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUses.length === 0) {
        if (acc.briefings || acc.winner) break;
        continue;
      }

      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      const ordered = [
        ...toolUses.filter((tu) => tu.name === "update_scratchpad"),
        ...toolUses.filter((tu) => tu.name !== "update_scratchpad"),
      ];
      for (const tu of ordered) {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        const result = applyToolInput(tu.name, input, acc);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });

      if (acc.briefings || acc.winner) {
        // Allow a trailing scratchpad in the same batch; then stop.
        break;
      }
    }
  } catch (err) {
    console.error("[secret-test/gm] Claude call failed", err);
    if (!acc.briefings && !acc.winner) {
      acc.briefings = fallbackBriefings(opening);
    }
  }

  if (!acc.briefings && !acc.winner) {
    console.warn("[secret-test/gm] No terminal tool — using fallback briefings");
    acc.briefings = fallbackBriefings(opening);
  }

  return applyOutcome(state, acc);
}
