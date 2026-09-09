import Anthropic from "@anthropic-ai/sdk";
import { SEATS, STATES } from "../data/valden";
import type { CosTranslation, FactionId, SecretTestState, Winner } from "../types";
import {
  GM_MAX_ROUNDS,
  GM_MAX_TOKENS,
  LLM_TIMEOUT_MS,
  MAX_VOTER_POLLS,
  SCRATCHPAD_MAX_CHARS,
  isDebateMonth,
} from "../types";
import { emptyTranslation } from "./state";
import { pollVoters, type VoterSample } from "./poll";
import { statesWon, tallyStates } from "./tally";

function trimScratchpad(text: string): string {
  if (text.length <= SCRATCHPAD_MAX_CHARS) return text;
  return text.slice(0, SCRATCHPAD_MAX_CHARS);
}

function clampLean(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

function clampTurnout(n: number): number {
  return Math.max(0.2, Math.min(0.95, n));
}

const SYSTEM_PROMPT = `You are the election GM for the Republic of Valden, a small northern federation. Two blank-slate campaigns (red and blue). 12 months. 17 constituencies in 5 states. Winning a majority of seats in a state takes the state. Winning 3 states wins the election.

You are discerning. A candidate cannot visit 12 seats. Trust the chief-of-staff translations for what actually happened and what was refused. Charge money honestly. If they fundraise, you decide the take. If they overpromised, the CoS already cut it — do not secretly grant the rest.

HARD
- Money is the only public hard resource. Apply cash deltas. Do not go below 0.
- Seat lean is −1 (solid blue) to +1 (solid red). Turnout 0.2–0.95. Patch only seats that moved.
- Issues: 1–3 national issues each month. If a campaign did not opine in their directive, they have no stance — you may punish silence or let it pass.
- Debates: months 9 and 11. If the NEXT month is 9 or 11, set three shared questions. Debate answers come raw — both candidates get the same questions.

SCRATCHPAD
Rewrite the whole ledger every turn: money, leans, turnout, secrets, what each CoS actually executed, poll notes. Dense. Numbered.

POLLING
If you are unsure how a line lands, call poll_voters (max 8: any seats, any demographics). Cheap bots. Then judge. If you already know, do not poll.

TOOLS
1. update_scratchpad — full rewrite
2. apply_world — money deltas, seat patches, issues, optional debateQuestions (exactly 3 strings if next month is a debate)
3. poll_voters — discretionary
4. declare_winner — only after month 12's campaign is applied (or if the race is mathematically dead). Include state-by-state and campaign breakdowns.

Opening month: no actions yet. Seed the world, issues, and a first read of the map. Do not declare a winner.`;

const GM_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "update_scratchpad",
    description: "Replace the entire true ledger. Players never see this.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "apply_world",
    description:
      "Apply cash deltas, seat lean/turnout patches, next-month issues, and debate questions if the next month is 9 or 11.",
    input_schema: {
      type: "object",
      properties: {
        moneyDelta: {
          type: "object",
          properties: { red: { type: "number" }, blue: { type: "number" } },
        },
        seats: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              lean: { type: "number" },
              turnout: { type: "number" },
            },
            required: ["id"],
          },
        },
        issues: { type: "array", items: { type: "string" } },
        debateQuestions: { type: "array", items: { type: "string" } },
        noteForBriefings: {
          type: "string",
          description: "Short factual note both chiefs of staff will read (public events, not secrets).",
        },
      },
    },
  },
  {
    name: "poll_voters",
    description: `Spin up up to ${MAX_VOTER_POLLS} cheap voter bots. Any seat, any demographic.`,
    input_schema: {
      type: "object",
      properties: {
        samples: {
          type: "array",
          items: {
            type: "object",
            properties: {
              seatId: { type: "string" },
              demographic: { type: "string" },
              question: { type: "string" },
            },
            required: ["seatId", "demographic", "question"],
          },
        },
      },
      required: ["samples"],
    },
  },
  {
    name: "declare_winner",
    description: "End the race after month 12 resolve.",
    input_schema: {
      type: "object",
      properties: {
        winner: { type: "string", enum: ["red", "blue"] },
        reason: { type: "string" },
        redBreakdown: { type: "string" },
        blueBreakdown: { type: "string" },
      },
      required: ["winner", "reason", "redBreakdown", "blueBreakdown"],
    },
  },
];

function formatHistory(state: SecretTestState): string {
  if (state.history.length === 0) return "(none)";
  return state.history
    .map((h) => {
      return [
        `— Month ${h.month} —`,
        `RED did: ${h.translations.red?.executed ?? h.actions.red}`,
        `BLUE did: ${h.translations.blue?.executed ?? h.actions.blue}`,
        h.debateAnswers?.red ? `RED debate: ${h.debateAnswers.red.join(" | ")}` : "",
        h.debateAnswers?.blue ? `BLUE debate: ${h.debateAnswers.blue.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function mapBlock(state: SecretTestState): string {
  return state.seats
    .map((s) => {
      const def = SEATS.find((d) => d.id === s.id);
      return `${s.id} ${def?.name} [${def?.stateId}] lean=${s.lean.toFixed(2)} turn=${s.turnout.toFixed(2)}`;
    })
    .join("\n");
}

export function buildGmUserMessage(
  state: SecretTestState,
  translations: Record<FactionId, CosTranslation>,
  names: Record<FactionId, string>,
  opening: boolean
): string {
  const nextMonth = Math.min(12, opening ? 1 : state.month + 1);
  const needDebateQs = isDebateMonth(nextMonth);

  if (opening) {
    return `OPENING — Month 1. Republic of Valden. Red candidate: ${names.red}. Blue candidate: ${names.blue}.
Both start at kr 4,000,000. No directives yet.
Set issues and a first scratchpad. apply_world with issues (keep leans near seed unless you have a reason). Do not declare a winner.
${needDebateQs ? "Next month is a debate month — include 3 debateQuestions." : ""}

MAP:\n${mapBlock(state)}
SCRATCHPAD:\n${state.scratchpad || "(empty)"}`;
  }

  return `MONTH ${state.month} RESOLVE. Next month will be ${nextMonth}.
Red: ${names.red}. Blue: ${names.blue}.
Cash now — red kr ${state.cash.red} / blue kr ${state.cash.blue}.
${needDebateQs ? "NEXT month is a DEBATE month. apply_world MUST include exactly 3 debateQuestions." : "No debate questions unless you want to preview none."}
${state.month === 12 ? "This is the LAST campaign month. After applying the world, declare_winner from the map (3 of 5 states)." : "Do not declare a winner."}

RED CoS executed: ${translations.red.executed}
RED deferred: ${translations.red.deferred}
RED cost asked: kr ${translations.red.costKr}
RED priorities: ${translations.red.prioritiesForGm}
RED raw directive: ${state.pendingActions.red?.text ?? "(none)"}
RED debate: ${state.pendingActions.red?.debateAnswers?.join(" | ") ?? "n/a"}

BLUE CoS executed: ${translations.blue.executed}
BLUE deferred: ${translations.blue.deferred}
BLUE cost asked: kr ${translations.blue.costKr}
BLUE priorities: ${translations.blue.prioritiesForGm}
BLUE raw directive: ${state.pendingActions.blue?.text ?? "(none)"}
BLUE debate: ${state.pendingActions.blue?.debateAnswers?.join(" | ") ?? "n/a"}

ISSUES THIS MONTH: ${state.issues.join("; ")}
MAP:\n${mapBlock(state)}
HISTORY:\n${formatHistory(state)}
SCRATCHPAD:\n${state.scratchpad || "(empty)"}`;
}

export interface Acc {
  scratchpad: string;
  applied: boolean;
  moneyDelta: { red: number; blue: number };
  seatPatches: { id: string; lean?: number; turnout?: number }[];
  issues: string[];
  debateQuestions: string[];
  noteForBriefings: string;
  winner?: { factionId: FactionId; reason: string; breakdowns: Record<FactionId, string> };
  pollsUsed: number;
}

function applyTool(
  name: string,
  input: Record<string, unknown>,
  acc: Acc
): { result: string; samples?: VoterSample[] } {
  if (name === "update_scratchpad") {
    acc.scratchpad = trimScratchpad(typeof input.text === "string" ? input.text : "");
    return { result: `Scratchpad stored (${acc.scratchpad.length} chars).` };
  }
  if (name === "apply_world") {
    const md = input.moneyDelta as { red?: number; blue?: number } | undefined;
    acc.moneyDelta = {
      red: typeof md?.red === "number" ? md.red : acc.moneyDelta.red,
      blue: typeof md?.blue === "number" ? md.blue : acc.moneyDelta.blue,
    };
    if (Array.isArray(input.seats)) {
      acc.seatPatches = input.seats
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof s.id === "string")
        .map((s) => ({
          id: String(s.id),
          lean: typeof s.lean === "number" ? s.lean : undefined,
          turnout: typeof s.turnout === "number" ? s.turnout : undefined,
        }));
    }
    if (Array.isArray(input.issues)) {
      acc.issues = input.issues.filter((x): x is string => typeof x === "string").slice(0, 4);
    }
    if (Array.isArray(input.debateQuestions)) {
      acc.debateQuestions = input.debateQuestions.filter((x): x is string => typeof x === "string").slice(0, 3);
    }
    if (typeof input.noteForBriefings === "string") acc.noteForBriefings = input.noteForBriefings;
    acc.applied = true;
    return { result: "World patch stored." };
  }
  if (name === "poll_voters") {
    const left = MAX_VOTER_POLLS - acc.pollsUsed;
    if (left <= 0) return { result: "Poll cap reached this turn." };
    const raw = Array.isArray(input.samples) ? input.samples : [];
    const samples: VoterSample[] = raw
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        seatId: typeof s.seatId === "string" ? s.seatId : "",
        demographic: typeof s.demographic === "string" ? s.demographic : "resident",
        question: typeof s.question === "string" ? s.question : "How do you feel about the campaigns this month?",
      }))
      .filter((s) => s.seatId)
      .slice(0, left);
    acc.pollsUsed += samples.length;
    return { result: `Polling ${samples.length} voters…`, samples };
  }
  if (name === "declare_winner") {
    const winner = input.winner === "blue" ? "blue" : input.winner === "red" ? "red" : null;
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    const redBreakdown = typeof input.redBreakdown === "string" ? input.redBreakdown.trim() : "";
    const blueBreakdown = typeof input.blueBreakdown === "string" ? input.blueBreakdown.trim() : "";
    if (!winner || !reason || !redBreakdown || !blueBreakdown) {
      return { result: "winner, reason, redBreakdown, blueBreakdown required." };
    }
    acc.winner = {
      factionId: winner,
      reason,
      breakdowns: { red: redBreakdown, blue: blueBreakdown },
    };
    return { result: "Winner recorded." };
  }
  return { result: `Unknown tool ${name}` };
}

function fallbackDebateQuestions(): string[] {
  return [
    "Should Valden expand the Gas Terminal?",
    "How would you cut hospital waiting lists without raising the payroll tax?",
    "What is your line on fishing quotas for the Skerries?",
  ];
}

export function applyGmOutcome(
  state: SecretTestState,
  translations: Record<FactionId, CosTranslation>,
  acc: Acc,
  opening: boolean
): { next: SecretTestState; briefingNote: string } {
  const next: SecretTestState = {
    ...state,
    scratchpad: acc.scratchpad || state.scratchpad,
    gmLock: false,
    gmLockAt: undefined,
  };

  if (acc.applied || acc.winner) {
    next.cash = {
      red: Math.max(0, Math.round(state.cash.red + (acc.moneyDelta.red || 0))),
      blue: Math.max(0, Math.round(state.cash.blue + (acc.moneyDelta.blue || 0))),
    };
    if (!acc.applied) {
      next.cash = {
        red: Math.max(0, state.cash.red - (translations.red.costKr || 0)),
        blue: Math.max(0, state.cash.blue - (translations.blue.costKr || 0)),
      };
    }
    const byId = new Map(state.seats.map((s) => [s.id, { ...s }]));
    for (const p of acc.seatPatches) {
      const cur = byId.get(p.id);
      if (!cur) continue;
      if (typeof p.lean === "number") cur.lean = clampLean(p.lean);
      if (typeof p.turnout === "number") cur.turnout = clampTurnout(p.turnout);
      byId.set(p.id, cur);
    }
    next.seats = [...byId.values()];
    if (acc.issues.length) next.issues = acc.issues;
  } else if (!opening) {
    next.cash = {
      red: Math.max(0, state.cash.red - translations.red.costKr),
      blue: Math.max(0, state.cash.blue - translations.blue.costKr),
    };
  }

  const nextMonth = opening ? 1 : Math.min(12, state.month + (acc.winner ? 0 : 1));
  if (!opening && !acc.winner) {
    next.month = state.month + 1;
  } else if (opening) {
    next.month = 1;
  }

  if (isDebateMonth(next.month)) {
    next.debateQuestions =
      acc.debateQuestions.length === 3 ? acc.debateQuestions : fallbackDebateQuestions();
  } else {
    next.debateQuestions = [];
  }

  if (!opening) {
    next.history = [
      ...state.history,
      {
        month: state.month,
        briefings: { ...state.briefings },
        actions: {
          red: state.pendingActions.red?.text ?? "",
          blue: state.pendingActions.blue?.text ?? "",
        },
        translations,
        debateAnswers: {
          red: state.pendingActions.red?.debateAnswers,
          blue: state.pendingActions.blue?.debateAnswers,
        },
      },
    ];
  }

  next.pendingActions = {};
  next.lastTranslations = translations;

  if (acc.winner || (!opening && state.month === 12)) {
    const states = tallyStates(next.seats);
    let winnerFaction = acc.winner?.factionId;
    if (!winnerFaction) {
      const redN = statesWon(states, "red");
      const blueN = statesWon(states, "blue");
      winnerFaction = redN === blueN ? (next.cash.red >= next.cash.blue ? "red" : "blue") : redN > blueN ? "red" : "blue";
    }
    next.winner = {
      factionId: winnerFaction,
      reason: acc.winner?.reason ?? `Final map: red ${statesWon(states, "red")} states, blue ${statesWon(states, "blue")}.`,
      breakdowns: acc.winner?.breakdowns ?? {
        red: "See the map and the money.",
        blue: "See the map and the money.",
      },
      states,
    };
    next.phase = "ended";
    next.month = 12;
  } else {
    next.phase = "awaiting_actions";
  }

  void nextMonth;
  return { next, briefingNote: acc.noteForBriefings || acc.scratchpad.slice(0, 400) };
}

export async function runGmTurn(
  state: SecretTestState,
  translations: Record<FactionId, CosTranslation>,
  names: Record<FactionId, string>,
  opening: boolean
): Promise<{ next: SecretTestState; briefingNote: string }> {
  const acc: Acc = {
    scratchpad: state.scratchpad,
    applied: false,
    moneyDelta: { red: 0, blue: 0 },
    seatPatches: [],
    issues: [],
    debateQuestions: [],
    noteForBriefings: "",
    pollsUsed: 0,
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (!opening) {
      acc.moneyDelta = { red: -translations.red.costKr, blue: -translations.blue.costKr };
      acc.applied = true;
    }
    acc.issues = state.issues.length ? state.issues : ["Hospital waits", "Quotas", "Gas Terminal"];
    acc.noteForBriefings = "Quiet month. The map barely moved.";
    return applyGmOutcome(state, translations, acc, opening);
  }

  const client = new Anthropic({ apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: 0 });
  const model = process.env.MODEL_GM?.trim() || "claude-sonnet-4-6";
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: buildGmUserMessage(state, translations, names, opening) },
  ];
  const deadline = Date.now() + LLM_TIMEOUT_MS * GM_MAX_ROUNDS;

  try {
    for (let round = 0; round < GM_MAX_ROUNDS; round++) {
      if (Date.now() > deadline - 1500) break;
      if (round > 0 && !acc.applied && !acc.winner) {
        messages.push({
          role: "user",
          content: "Call apply_world now. After month 12, also declare_winner. Do not poll.",
        });
      }
      const response = await client.messages.create({
        model,
        max_tokens: GM_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: GM_TOOLS,
        messages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ thinking: { type: "disabled" } } as any),
      });
      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      if (toolUses.length === 0) {
        if (acc.applied || acc.winner) break;
        continue;
      }
      messages.push({ role: "assistant", content: response.content });
      const ordered = [
        ...toolUses.filter((t) => t.name === "update_scratchpad"),
        ...toolUses.filter((t) => t.name === "poll_voters"),
        ...toolUses.filter((t) => t.name !== "update_scratchpad" && t.name !== "poll_voters"),
      ];
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const tu of ordered) {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        const { result, samples } = applyTool(tu.name, input, acc);
        let content = result;
        if (samples?.length) {
          if (Date.now() > deadline - 12_000) {
            content = "Polls skipped — short on time. Judge from what you already know.";
          } else {
            const replies = await pollVoters(samples);
            content = replies
              .map((r) => `[${r.seatId} / ${r.demographic}] ${r.reply}`)
              .join("\n");
          }
        }
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content });
      }
      messages.push({ role: "user", content: toolResults });
      if ((acc.applied || acc.winner) && !toolUses.some((t) => t.name === "poll_voters")) {
        break;
      }
    }
  } catch (err) {
    console.error("[secret-test/gm]", err);
  }

  if (!acc.applied && !acc.winner && !opening) {
    acc.moneyDelta = { red: -translations.red.costKr, blue: -translations.blue.costKr };
    acc.applied = true;
    acc.noteForBriefings = "The month closed without a full GM write. Costs were taken as the CoS estimated.";
  }

  return applyGmOutcome(state, translations, acc, opening);
}

export function openingTranslations(): Record<FactionId, CosTranslation> {
  return { red: emptyTranslation(), blue: emptyTranslation() };
}
