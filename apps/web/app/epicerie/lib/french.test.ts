import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFrenchUtterance, labelForLine, looksFrench, reviewProse } from "./french";

describe("what can be read aloud", () => {
  it("accepts French, including a messy try", () => {
    assert.equal(looksFrench("Bonjour, je voudrais une baguette."), true);
    assert.equal(looksFrench("une baguette"), true);
    assert.equal(looksFrench("Ah, une baguette ! Et avec ça ?"), true);
    assert.equal(looksFrench("combien"), true);
    assert.equal(looksFrench("merci"), true);
    assert.equal(looksFrench("le chocolat"), true);
    assert.equal(looksFrench("bonjur je voudre un bagette"), true);
    assert.equal(looksFrench("Ça"), true);
  });

  it("refuses English", () => {
    assert.equal(looksFrench("I want some eggs"), false);
    assert.equal(looksFrench("eggs"), false);
    assert.equal(looksFrench("how much"), false);
    assert.equal(looksFrench("hello"), false);
    assert.equal(looksFrench("chocolate"), false);
    assert.equal(looksFrench("That's not French"), false);
    assert.equal(looksFrench(""), false);
    assert.equal(looksFrench("ok"), false);
    assert.equal(looksFrench("Merde !"), true);
    assert.equal(looksFrench("PUTAIN"), true);
  });

  it("treats French swearing as French", () => {
    assert.equal(isFrenchUtterance("Merde! MERDE!"), true);
    assert.equal(isFrenchUtterance("PUTAIN!"), true);
    assert.equal(isFrenchUtterance("PUTAIN TU ES PUTAIN"), true);
    assert.equal(labelForLine("English", "Merde! MERDE!"), "French");
    assert.equal(labelForLine("English", "PUTAIN!"), "French");
    assert.equal(labelForLine("Unclear", "PUTAIN TU ES PUTAIN"), "French");
    assert.equal(labelForLine("English", "I want some eggs please"), "English");
    assert.equal(labelForLine("Unclear", "Zero six?"), "Unclear");
    assert.equal(
      reviewProse("Nothing landed.</analysis>\n<parameter name=\"phrases\">[{\"fr\":\"Merde\"}]"),
      "Nothing landed.",
    );
  });
});
