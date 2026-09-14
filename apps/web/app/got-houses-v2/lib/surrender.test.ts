import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aiMayDecideTerms, playerMessageLooksLikeTermsOffer } from "./surrender";
import { INITIAL_GAME_STATE } from "../data/initial-state";

describe("playerMessageLooksLikeTermsOffer", () => {
  it("counts a spoken offer as terms", () => {
    assert.equal(
      playerMessageLooksLikeTermsOffer(
        "Open the gates and your men may march out with their lives."
      ),
      true
    );
    assert.equal(
      playerMessageLooksLikeTermsOffer("I offer you terms: spare the garrison."),
      true
    );
  });

  it("does not let the host AI sue for a human garrison", () => {
    const holdId = "21";
    const holdStates = {
      ...INITIAL_GAME_STATE.holdStates,
      [holdId]: {
        ...INITIAL_GAME_STATE.holdStates[holdId],
        controller: "westerlands" as const,
        garrison: {
          ...INITIAL_GAME_STATE.holdStates[holdId].garrison,
          faction: "westerlands" as const,
        },
      },
    };
    assert.equal(
      aiMayDecideTerms({ adminMode: false, holdStates }, holdId),
      false
    );
    assert.equal(
      aiMayDecideTerms({ adminMode: true, holdStates }, holdId),
      true
    );
  });

  it("does not treat a question about terms as an offer", () => {
    assert.equal(playerMessageLooksLikeTermsOffer("What are your terms?"), false);
    assert.equal(
      playerMessageLooksLikeTermsOffer("How long can you hold?"),
      false
    );
  });
});
