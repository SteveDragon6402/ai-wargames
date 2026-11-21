import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eurosInWords, frenchNumber, spellMoneyInSpeech } from "./money-words";

describe("prices in words", () => {
  it("says the numbers a shopkeeper would say", () => {
    assert.equal(frenchNumber(21), "vingt et un");
    assert.equal(frenchNumber(71), "soixante et onze");
    assert.equal(frenchNumber(80), "quatre-vingts");
    assert.equal(frenchNumber(81), "quatre-vingt-un");
    assert.equal(frenchNumber(91), "quatre-vingt-onze");
    assert.equal(eurosInWords(100), "un euro");
    assert.equal(eurosInWords(440), "quatre euros quarante");
    assert.equal(eurosInWords(250), "deux euros cinquante");
    assert.equal(eurosInWords(80), "quatre-vingts centimes");
    assert.equal(eurosInWords(180), "un euro quatre-vingts");
  });

  it("rewrites digit prices and leaves the rest of the sentence", () => {
    assert.equal(spellMoneyInSpeech("Ça fait 4,40 €."), "Ça fait quatre euros quarante.");
    assert.equal(spellMoneyInSpeech("C'est 12 euros et 50 centimes."), "C'est douze euros cinquante.");
    assert.equal(spellMoneyInSpeech("Je m'appelle Gérard."), "Je m'appelle Gérard.");
    assert.equal(spellMoneyInSpeech("Voilà, 2 euros."), "Voilà, deux euros.");
  });
});
