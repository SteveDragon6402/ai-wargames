import Anthropic from "@anthropic-ai/sdk";
import type { FactionId, SecretTestState } from "../types";
import { GM_MAX_TOKENS, SCRATCHPAD_MAX_CHARS } from "../types";
import { archiveCurrentTurn, isOpeningResolve } from "./state";

const SYSTEM_PROMPT = `You are the hidden chronicler and game-master of a secret correspondence wargame set in the Wars of the Roses, beginning in England, 1455.

Two human players command the houses. You are the entire world: weather, harvests, treasuries, affinities, spies, bishops, captains, the court of Henry VI, Margaret of Anjou, Warwick, the City of London, Calais, the north, Wales, Ireland. There is no board. What you write in the scratchpad is true. What you write in a briefing is only what that house would hear.

HARD RULES
- Never reveal the scratchpad, the other house's briefing, or the other house's orders to a player. Briefings are asymmetric: rumours, riders, incomplete scouting, flattering lies from retainers, genuine intelligence mixed with fog.
- Do not dump the true map into both letters. A victory for one side may reach the other as a rumour, a delayed courier, or not at all this turn.
- Prefer qualitative state over fake numbers. Treasury is "the wool customs are thin" not "gold: 47". Armies are hosts, retinues, affinities — condition, loyalty, hunger — not hit points.
- Use period proper nouns (places, houses, offices). Write briefings as dispatches a 15th-century councillor might receive: concrete, political, occasionally bloody. No modern slang, no game-UI talk, no "as an AI".
- Each briefing should be a proper letter (roughly 200–500 words): situation as that house knows it, pressures, opportunities, and what their people are asking of them. Address the house, not "Player 1".
- You must use tools. First update_scratchpad to keep the true ledger current, then either issue_briefings (war continues) or declare_winner (war decided).
- Do not declare a winner on the opening turn. Do not end after a single exchange unless a player has done something catastrophically decisive (the rival house extinguished, the usurper crowned and unopposed, the realm clearly settled). Prefer a campaign of several seasons.
- When you issue_briefings after player orders, those letters are the NEXT turn's dispatches — they must reflect what actually followed from both houses' orders, as each house would learn it.
- Personality breakdowns (on declare_winner only) are deep: how they used secrecy, mercy, terror, patience, rashness, money, marriage, and the church. Write as a later Tudor historian who has read both councils' papers. Several substantial paragraphs each.

THE HOUSES
- Lancaster (red rose): the royal house of Henry VI. Weak king, fierce queen, Beaufort and Tudor affinities, the north and the west often lean this way — unless you decide otherwise in the scratchpad.
- York (white rose): Richard, Duke of York, and his sons. Claim, protectorate, Calais, the marcher lords, Warwick's kingmaking — unless you decide otherwise.

Players are the directing minds of each house, not locked to one historical body. You may place them as the duke, the queen's council, a captain of Calais, etc., so long as it is consistent in the scratchpad.`;

export const GM_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "update_scratchpad",
    description:
      "Replace your private ledger of the true world. Players never see this. Track treasury, influence, diplomacy, who holds which castle, hosts in the field, secret deals, casualties, the king's health, and anything else you need. Keep it current and dense.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "issue_briefings",
    description:
      "Send this turn's private dispatch to each house. Asymmetric intelligence only. Call when the war continues. After player orders, these letters are the NEXT turn.",
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
      "End the war when the throne, the rival house, or the political reality is clearly decided. Historian's verdict plus a deep personality breakdown of each player.",
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
    return `OPENING OF THE WAR — England, 1455. Henry VI sits weakly on the throne. The roses have not yet fully drawn.

Lancaster is commanded by: ${lanc}
York is commanded by: ${york}

There are no player orders yet. There is no history.

YOUR SCRATCHPAD (empty if first thought):
${state.scratchpad || "(empty)"}

Update the scratchpad with the starting political and military situation, then issue_briefings for Turn 1 — the first private letters each council receives as the realm slides toward war.`;
  }

  return `TURN ${state.turn} RESOLVE

Lancaster is commanded by: ${lanc}
York is commanded by: ${york}

The players have sealed orders in reply to the briefings you issued for this turn. Adjudicate what actually happened. Then update_scratchpad, and either issue_briefings for the NEXT turn or declare_winner.

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

=== COMPLETE HISTORY (all prior turns) ===
${formatHistory(state)}

=== YOUR SCRATCHPAD ===
${state.scratchpad || "(empty)"}`;
}

function fallbackBriefings(opening: boolean): Record<FactionId, string> {
  if (opening) {
    return {
      lancaster:
        "To the council of the red rose.\n\nThe king's peace frays. Henry is unwell in mind and the queen's party looks to you to hold the affinity together. Rumour out of the north says York musters under colour of 'good government'. The Exchequer is thin; the Calais garrison writes for pay. Write your will: whom you trust, where you spend treasure, and whether you strike or wait.",
      york:
        "To the council of the white rose.\n\nThe duke's claim is spoken more loudly in halls than in statute. Henry's court is a nest of Beauforts; the realm wants a protector and fears a usurper. Warwick's men in Calais ask whether they ride this season. A rider from Ludlow says the marcher tenantry will rise if you give the word. Write your will: alliance, delay, or the field.",
    };
  }
  return {
    lancaster:
      "To Lancaster.\n\nCouriers crossed in the night and the picture is incomplete. Your last orders were attempted; some bore fruit, some were blunted by weather, purse, or treachery you cannot yet name. The other rose is not idle. Send fresh instruction.",
    york:
      "To York.\n\nThe chronicler has only fragments. Your last orders went out; not all returned. London talks two ways at once. Instruct your captains and your friends at court before the next season closes.",
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
    acc.briefings = { lancaster, york };
    return "Briefings accepted. The turn may now advance.";
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
          ? "You must now call issue_briefings (war continues) or declare_winner (war decided). You may update_scratchpad first."
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
      for (const tu of toolUses) {
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
