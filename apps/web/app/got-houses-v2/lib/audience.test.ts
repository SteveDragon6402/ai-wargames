import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { DILEMMA_KINDS } from "../data/dilemma-kinds";
import type { Audience, GameState, PrisonerGroup } from "../types";
import {
  applyAudienceEffects,
  searchAudiences,
  validateAudienceOutcome,
  validateProposal,
  validateVoice,
} from "./audience";
import { searchDeeds } from "./deeds";

function northAudience(extra: Partial<Audience> = {}): Audience {
  return {
    id: "aud-north-1-roose-bolton",
    turn: 1,
    faction: "north",
    speakerId: "roose-bolton",
    addresseeId: "robb-stark",
    kind: "prisoners_fate",
    situation: "Captives from the last fight.",
    whyNow: "The column is slowed.",
    text: "My lord, the captives are a weight. What is your word?",
    options: [
      { id: "keep", label: "Keep them under guard" },
      { id: "free", label: "Turn them loose" },
      { id: "hang", label: "Hang a few as a lesson" },
    ],
    answer: { optionId: "keep", freeText: null },
    narration: null,
    effects: null,
    effectsApplied: false,
    skipped: false,
    ...extra,
  };
}

function prisoners(...ids: string[]): PrisonerGroup[] {
  return ids.map((id) => ({
    id,
    captorFaction: "north",
    faction: "westerlands",
    location: { kind: "army", armyId: "army-robb" },
    units: [{ house: "Lannister", type: "infantry", count: 40 }],
    characterIds: [],
    takenAtHoldId: "08",
    takenTurn: 1,
    origin: "battle",
    battleId: null,
  }));
}

describe("dilemma catalog", () => {
  it("offers about fifty tagged premises", () => {
    assert.ok(DILEMMA_KINDS.length >= 50);
    assert.ok(DILEMMA_KINDS.every((k) => k.id && k.premise && k.tags.length > 0));
  });
});

describe("validateProposal", () => {
  it("rejects the lord as speaker and a foreign NPC", () => {
    const lord = validateProposal(
      {
        speakerId: "robb-stark",
        addresseeId: "robb-stark",
        kind: "prisoners_fate",
        situation: "The captives.",
        whyNow: "Now.",
      },
      INITIAL_GAME_STATE,
      "north"
    );
    assert.equal(lord.ok, false);

    const foreign = validateProposal(
      {
        speakerId: "addam-marbrand",
        addresseeId: "robb-stark",
        kind: "prisoners_fate",
        situation: "The captives.",
        whyNow: "Now.",
      },
      INITIAL_GAME_STATE,
      "north"
    );
    assert.equal(foreign.ok, false);
  });

  it("accepts a living same-faction NPC", () => {
    const ok = validateProposal(
      {
        speakerId: "roose-bolton",
        addresseeId: "robb-stark",
        kind: "prisoners_fate",
        situation: "The captives slow the host at the Twins.",
        whyNow: "We took them this turn.",
      },
      INITIAL_GAME_STATE,
      "north"
    );
    assert.equal(ok.ok, true);
  });
});

describe("validateVoice", () => {
  it("needs a plea and exactly three options", () => {
    const short = validateVoice({ text: "No.", options: [] });
    assert.equal(short.ok, false);
    const two = validateVoice({
      text: "My lord, hear me on the captives.",
      options: [
        { id: "a", label: "Keep" },
        { id: "b", label: "Free" },
      ],
    });
    assert.equal(two.ok, false);
  });
});

describe("validateAudienceOutcome", () => {
  it("drops unknown army ids and enemy hosts", () => {
    const audience = northAudience();
    const checked = validateAudienceOutcome(
      {
        narration: "The camp took the word.",
        armyUpdates: [
          { armyId: "ghost-host", tiredness: "Invented." },
          { armyId: "army-tywin", morale: "Should not change." },
          { armyId: "army-robb", morale: "Obedient.", tiredness: "Tired of captives." },
        ],
      },
      INITIAL_GAME_STATE,
      audience
    );
    assert.ok(checked.notes.some((n) => /unknown army/.test(n)));
    assert.ok(checked.notes.some((n) => /enemy army/.test(n)));
    assert.deepEqual(
      checked.effects.armyUpdates.map((u) => u.armyId),
      ["army-robb"]
    );
  });

  it("drops unknown prisoner acts and over-large lists", () => {
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      prisoners: prisoners("p1", "p2", "p3"),
    };
    const checked = validateAudienceOutcome(
      {
        narration: "The sword went out.",
        prisonerActs: [
          { groupId: "ghost", action: "execute" },
          { groupId: "p1", action: "execute" },
          { groupId: "p2", action: "release" },
          { groupId: "p3", action: "execute" },
        ],
      },
      state,
      northAudience()
    );
    assert.ok(checked.notes.some((n) => /prisoner act/.test(n)));
    assert.ok(checked.notes.some((n) => /over-large/.test(n)));
    assert.equal(checked.effects.prisonerActs.length, 2);
    assert.deepEqual(
      checked.effects.prisonerActs.map((a) => a.groupId),
      ["p1", "p2"]
    );
  });

  it("drops forage at a hold the speaker's host does not occupy", () => {
    const checked = validateAudienceOutcome(
      {
        narration: "They would have stripped the west.",
        forageHolds: [{ holdId: "18", steps: 2 }],
      },
      INITIAL_GAME_STATE,
      northAudience()
    );
    assert.ok(checked.notes.some((n) => /unoccupied/.test(n)));
    assert.equal(checked.effects.forageHolds.length, 0);
  });
});

describe("search_audiences and counsel_given", () => {
  it("records a deed and can find the private counsel later", () => {
    const audience = northAudience();
    const next = applyAudienceEffects(INITIAL_GAME_STATE, audience, {
      armyUpdates: [],
      garrisonUpdates: [],
      prisonerActs: [],
      forageHolds: [],
      deedSummary: "Robb heard Roose after the last march.",
      deedDetail: "Roose asked after the captives. Robb kept them.",
    });
    const deeds = searchDeeds(next.deeds, { kind: "counsel_given" });
    assert.equal(deeds.length, 1);
    assert.match(deeds[0].summary, /heard Roose|Robb heard/i);

    const hits = searchAudiences(
      [
        {
          ...audience,
          text: "My lord, the captives are a weight.",
          narration: "The captives stay under guard.",
          effectsApplied: true,
        },
      ],
      { query: "captives", faction: "north" }
    );
    assert.equal(hits.length, 1);
    assert.match(hits[0].text, /captives/);
  });
});
