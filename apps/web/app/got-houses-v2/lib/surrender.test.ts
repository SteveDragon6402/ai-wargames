import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { playerMessageLooksLikeTermsOffer } from "./surrender";

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

  it("does not treat a question about terms as an offer", () => {
    assert.equal(playerMessageLooksLikeTermsOffer("What are your terms?"), false);
    assert.equal(
      playerMessageLooksLikeTermsOffer("How long can you hold?"),
      false
    );
  });
});
