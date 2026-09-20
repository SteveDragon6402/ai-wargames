import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInitialCharacters, warCouncilNpcIds } from "../data/characters";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { gameReducer } from "../hooks/useGameState";
import { livingBannermen } from "./audience";
import { collectBattleCharacterIds } from "./battle-briefs";
import { executeCharacterTool } from "./character-tools";
import type { CharacterToolContext } from "./character-tools";
import { normalizeState } from "./normalize-state";
import { buildSeatFateChoice } from "./pending-choices";
import {
  emptyStewardThread,
  isStewardCharacter,
  isStewardThread,
  stewardIdFor,
  stewardThreadIdFor,
} from "./steward";
import {
  STEWARD_RULE_TOPICS,
  explainRules,
  stewardRecommendedChips,
} from "./steward-prompts";
import { army, battle } from "./test-helpers";
import type { BattleReport, CharacterState, GameState, NpcAgentState } from "../types";

function toolCtx(): CharacterToolContext {
  return {
    actingCharacterId: "steward-north",
    characters: buildInitialCharacters(),
    armies: INITIAL_GAME_STATE.armies,
    battleReports: [],
    conversations: INITIAL_GAME_STATE.conversations,
    factionOrders: {
      north: {
        ...INITIAL_GAME_STATE.north,
        orders: [
          {
            armyId: "army-robb",
            fromHoldId: "08",
            toHoldId: "09",
          },
        ],
      },
      westerlands: INITIAL_GAME_STATE.westerlands,
    },
  };
}

function report(partial: Partial<BattleReport> = {}): BattleReport {
  return {
    id: "b1",
    turn: 1,
    holdId: "16",
    narrative: "They met in the mud.",
    shortSummary: "A fight at Riverrun",
    headline: "Riverrun held",
    holdResult: "north",
    casualties: [],
    fallen: [],
    retreatingArmyIds: [],
    ...partial,
  };
}

describe("steward characters", () => {
  const characters = buildInitialCharacters();

  it("seeds a household steward for each faction, not on a host", () => {
    const north = characters["steward-north"];
    const west = characters["steward-west"];
    assert.equal(north?.kind, "npc");
    assert.equal(west?.kind, "npc");
    assert.equal(north && isStewardCharacter(north), true);
    assert.equal(west && isStewardCharacter(west), true);
    assert.equal(north?.kind === "npc" ? north.armyId : "x", null);
    assert.equal(west?.kind === "npc" ? west.armyId : "x", null);
    assert.equal(stewardIdFor("north"), "steward-north");
    assert.equal(stewardIdFor("westerlands"), "steward-west");
  });

  it("keeps stewards out of the war council", () => {
    assert.equal(warCouncilNpcIds(characters, "north").includes("steward-north"), false);
    assert.equal(
      warCouncilNpcIds(characters, "westerlands").includes("steward-west"),
      false
    );
    assert.ok(warCouncilNpcIds(characters, "north").includes("roose-bolton"));
  });

  it("is not a bannerman who approaches for counsel", () => {
    const ids = livingBannermen(characters, "north").map((c) => c.id);
    assert.equal(ids.includes("steward-north"), false);
    assert.ok(ids.includes("roose-bolton"));
  });

  it("is not collected for battle briefs even if wrongly attached to a host", () => {
    const north = army({ id: "army-robb", faction: "north" });
    const west = army({ id: "army-tywin", faction: "westerlands" });
    const steward = characters["steward-north"] as NpcAgentState;
    const withHost: Record<string, CharacterState> = {
      ...characters,
      "steward-north": { ...steward, armyId: "army-robb" },
    };
    const ids = collectBattleCharacterIds(battle([north], [west]), withHost);
    assert.equal(ids.includes("steward-north"), false);
  });
});

describe("explain_rules", () => {
  it("lists known topics when none is asked", () => {
    const listed = explainRules();
    for (const topic of STEWARD_RULE_TOPICS) {
      assert.match(listed, new RegExp(topic));
    }
  });

  it("returns a handbook line for each topic and aliases", () => {
    assert.match(explainRules("move"), /adjacent/i);
    assert.match(explainRules("march"), /adjacent/i);
    assert.match(explainRules("lock"), /Lock/i);
    assert.match(explainRules("victory"), /turn 25/i);
    assert.match(explainRules("not-a-topic"), /No handbook entry/);
  });

  it("is available as a character tool", () => {
    const { result } = executeCharacterTool(
      "explain_rules",
      { topic: "move" },
      toolCtx(),
      new Map(),
      []
    );
    assert.match(result, /March/i);
  });

  it("refuses the handbook to a field commander", () => {
    const ctx = toolCtx();
    ctx.actingCharacterId = "roose-bolton";
    const { result } = executeCharacterTool(
      "explain_rules",
      { topic: "move" },
      ctx,
      new Map(),
      []
    );
    assert.match(result, /not yours/i);
  });

  it("reads standing orders for the steward's side", () => {
    const { result } = executeCharacterTool(
      "inspect_orders",
      {},
      toolCtx(),
      new Map(),
      []
    );
    assert.match(result, /Robb/);
    assert.match(result, /March/);
  });
});

describe("steward recommended chips", () => {
  it("always offers move, strength, and advice, plus a turn-1 how-to", () => {
    const chips = stewardRecommendedChips(INITIAL_GAME_STATE, "north");
    const labels = chips.map((c) => c.label);
    assert.ok(labels.includes("How does a turn work?"));
    assert.ok(labels.includes("How do I move a host?"));
    assert.ok(labels.includes("What is our strength?"));
    assert.ok(labels.includes("What should I do this turn?"));
    assert.equal(chips.find((c) => c.id === "advice")?.intent, "advice");
  });

  it("adds a fight chip after last-turn battles and a fate chip when lock is blocked", () => {
    const choice = buildSeatFateChoice({
      turn: 2,
      holdId: "16",
      faction: "north",
      promised: null,
      garrisonUnits: [],
      captiveCharacterIds: [],
      escortArmyIds: [],
      stormed: true,
    });
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      turn: 2,
      battleReports: [report()],
      pendingChoices: [choice],
    };
    const labels = stewardRecommendedChips(state, "north").map((c) => c.label);
    assert.equal(labels.includes("How does a turn work?"), false);
    assert.ok(labels.includes("What happened in that fight?"));
    assert.ok(labels.includes("What must I settle before I lock?"));
  });
});

describe("steward state", () => {
  it("seeds durable steward threads on a new game", () => {
    const north = INITIAL_GAME_STATE.conversations.find(
      (t) => t.id === stewardThreadIdFor("north")
    );
    assert.equal(isStewardThread(north), true);
    assert.equal(isStewardThread(emptyStewardThread("westerlands", 1)), true);
  });

  it("fills steward characters and flags on an old save", () => {
    const stripped = { ...INITIAL_GAME_STATE.characters };
    delete stripped["steward-north"];
    delete stripped["steward-west"];
    const raw = {
      ...INITIAL_GAME_STATE,
      characters: stripped,
      conversations: [],
      stewardOpen: undefined,
      stewardUnread: undefined,
      stewardBriefedTurn: undefined,
    } as unknown as GameState;
    const next = normalizeState(raw);
    assert.equal(next.characters["steward-north"]?.kind, "npc");
    assert.equal(next.characters["steward-west"]?.kind, "npc");
    assert.equal(next.stewardOpen, false);
    assert.equal(next.stewardUnread?.north, false);
    assert.equal(next.stewardBriefedTurn?.westerlands, null);
    assert.ok(
      next.conversations.some((t) => t.id === stewardThreadIdFor("north"))
    );
  });

  it("upserts a steward thread without opening Talk", () => {
    const thread = emptyStewardThread("north", 1);
    thread.messages = [
      {
        id: "m1",
        speakerId: "steward-north",
        speakerName: "Hallis Mollen",
        text: "The table is yours.",
        at: 1,
        kind: "chat",
      },
    ];
    const next = gameReducer(INITIAL_GAME_STATE, {
      type: "UPSERT_CONVERSATION",
      thread,
    });
    assert.equal(next.talkPickerOpen, false);
    assert.equal(next.focusedConversationId, null);
    assert.equal(
      next.conversations.find((t) => t.id === thread.id)?.messages.length,
      1
    );
  });

  it("opens the steward dock and clears unread for the active side", () => {
    const dirty: GameState = {
      ...INITIAL_GAME_STATE,
      stewardUnread: { north: true, westerlands: true },
    };
    const next = gameReducer(dirty, { type: "SET_STEWARD_OPEN", open: true });
    assert.equal(next.stewardOpen, true);
    assert.equal(next.stewardUnread?.north, false);
    assert.equal(next.stewardUnread?.westerlands, true);
  });
});
