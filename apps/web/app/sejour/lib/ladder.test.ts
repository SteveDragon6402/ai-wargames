import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestRecipe } from "./ladder";

describe("what she suggests cooking", () => {
  it("starts on eggs and repeats them until day 3", () => {
    assert.equal(suggestRecipe(1, []).id, "eggs");
    assert.equal(suggestRecipe(2, ["eggs"]).id, "eggs");
  });

  it("opens tartines on day 3 only after eggs", () => {
    assert.equal(suggestRecipe(3, []).id, "eggs");
    assert.equal(suggestRecipe(3, ["eggs"]).id, "tartines");
    assert.equal(suggestRecipe(4, ["eggs", "tartines"]).id, "tartines");
  });

  it("keeps soup behind the omelette and day 7", () => {
    assert.equal(suggestRecipe(7, []).id, "eggs");
    assert.equal(suggestRecipe(7, ["eggs"]).id, "tartines");
    assert.equal(suggestRecipe(6, ["eggs", "tartines", "omelette"]).id, "omelette");
    assert.equal(suggestRecipe(7, ["eggs", "tartines", "omelette"]).id, "soup");
    assert.equal(suggestRecipe(5, ["eggs", "tartines"]).id, "omelette");
  });
});
