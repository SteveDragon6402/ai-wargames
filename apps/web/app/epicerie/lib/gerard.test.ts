import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { basketSheet, cleanLine, counterSheet, describeTurn, neutralGesture, persona, spokenFromText } from "./gerard";

describe("what Gérard hears", () => {
  it("describes pointing, gestures and silence", () => {
    assert.match(describeTurn({ role: "you", text: "", pointed: "honey" }), /^\[The customer points at a honey pot .* without a word\.\]$/);
    assert.match(describeTurn({ role: "you", text: "Ça", pointed: "lemon", gesture: "two" }), /points at a lemon .* and holds up two fingers\.\] Customer \(as you heard it\): Ça$/);
    assert.equal(describeTurn({ role: "you", text: "Bonjour" }), "Customer (as you heard it): Bonjour");
  });

  it("keeps English product names out of his stage directions", () => {
    assert.equal(neutralGesture("Places two lemons on the counter."), "Places two of them on the counter.");
    assert.equal(neutralGesture("Point at the honey jar, then hold up one finger."), "Point at it, then hold up one finger.");
    assert.equal(neutralGesture("holds up one chocolate bar"), "holds up one of them");
    assert.equal(neutralGesture("taps the jar of honey"), "taps the jar");
    assert.equal(neutralGesture("Sets three onions on the counter, raises eyebrows."), "Sets three of them on the counter, raises eyebrows.");
    assert.equal(neutralGesture("Holds up six fingers, then taps the counter."), "Holds up six fingers, then taps the counter.");
    assert.equal(neutralGesture("Places the baguette on the counter, smiling."), "Places it on the counter, smiling.");
    assert.equal(neutralGesture("holds up the baguette, then one finger"), "holds it up, then one finger");
    assert.equal(describeTurn({ role: "gerard", text: "Bonjour !" }), "You: Bonjour !");
    assert.equal(describeTurn({ role: "event", text: "The bell rings." }), "[The bell rings.]");
  });

  it("never gives him the English name of what is pointed at", () => {
    const seen = describeTurn({ role: "you", text: "", pointed: "camembert" });
    assert.doesNotMatch(seen, /Camembert cheese/);
    assert.match(seen, /un camembert/);
  });

  it("describes the counter and the bag", () => {
    assert.match(counterSheet([], null), /empty/);
    assert.match(counterSheet([{ itemId: "lemon", qty: 2 }], null), /2 × un citron .* 1,20 €\. The till is not rung up yet\./);
    assert.match(counterSheet([{ itemId: "lemon", qty: 2 }], 100), /The till shows 1,00 €\./);
    assert.match(basketSheet([{ itemId: "eggs", qty: 1 }]), /1 × une boîte de six œufs/);
  });

  it("never mentions learning in the persona", () => {
    const text = persona({ notes: ["Likes honey."], visits: 2, address: "madame" });
    assert.doesNotMatch(text, /learn|lesson|game|student|teach/i);
    assert.match(text, /Likes honey/);
    assert.match(text, /as madame/);
    assert.match(persona({ notes: [], visits: 0, address: "unknown" }), /never seen this customer/);
  });
});

describe("what Gérard says", () => {
  it("cleans stage directions and quotes", () => {
    assert.equal(cleanLine('"Voilà ! *il sourit* Et avec ça ?"'), "Voilà ! Et avec ça ?");
    assert.equal(cleanLine("« Bonjour (Hello) »"), "Bonjour");
  });

  it("recovers a speak call written out as text", () => {
    const raw = `<invoke name="speak">
<parameter name="line">Voilà, trois oignons.</parameter>
<parameter name="expression">smile</parameter>
<parameter name="gesture">Sets them down.</parameter>
</invoke>`;
    assert.deepEqual(spokenFromText(raw), { line: "Voilà, trois oignons.", expression: "smile", gesture: "Sets them down." });
    assert.deepEqual(spokenFromText("Bonjour !"), { line: "Bonjour !", expression: "neutral", gesture: "" });
    assert.equal(spokenFromText("   "), null);
  });
});
