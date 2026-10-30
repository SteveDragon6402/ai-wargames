import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addBookPage, addPhrase, emptySave, movePhrase, parseSave, recordStudy } from "./save";

describe("the phrasebook", () => {
  it("keeps a French line and refuses one that is not French", () => {
    const added = addPhrase([], { fr: "Je voudrais des œufs.", en: "I would like some eggs.", source: "you", day: 0 });
    assert.equal(added.length, 1);
    assert.equal(addPhrase(added, { fr: "I would like eggs", en: "eggs", source: "you", day: 0 }).length, 1);
    assert.equal(addPhrase(added, { fr: "Je voudrais des œufs.", en: "again", source: "you", day: 1 }).length, 1);
  });

  it("keeps an old phrase on the first page and lets a new page take it", () => {
    const save = parseSave({ version: 1, day: 0, phrases: [{ id: "a", fr: "Bonjour.", en: "Hello.", source: "you", day: 0 }] });
    assert.equal(save?.phrases[0]?.pageId, "page-1");
    const pages = addBookPage(save?.pages ?? [], "The shop");
    assert.equal(pages.length, 2);
    assert.equal(movePhrase(save?.phrases ?? [], "a", pages[1].id)[0]?.pageId, pages[1].id);
  });
});

describe("the homestay save", () => {
  it("reads a stay and refuses the shop's save", () => {
    const save = { ...emptySave(), day: 2, address: "madame" as const, cooked: ["eggs"] };
    assert.equal(parseSave(save)?.day, 2);
    assert.equal(parseSave({ version: 1, address: "monsieur", day: 0, visits: 3 })?.day, 0);
    assert.equal(parseSave({ version: 1, day: 0, cards: [{ id: "a", day: 0, text: "Salut", strokes: [[0, 0, 10, 10]] }] })?.cards.length, 1);
    assert.equal(parseSave(null), null);
    assert.equal(parseSave({ version: 2, day: 0 }), null);
    assert.equal(parseSave({ version: 1, day: -1 }), null);
    assert.deepEqual(parseSave({ version: 1, day: 0 })?.gaps, []);
    assert.deepEqual(parseSave({ version: 1, day: 0 })?.mastered, []);
    const studied = recordStudy(emptySave(), [{ id: "vous", note: "tu with the shopkeeper" }], ["je"]);
    assert.deepEqual(studied.mastered, ["je"]);
    assert.equal(studied.gaps[0]?.id, "vous");
    assert.deepEqual(recordStudy({ ...emptySave(), gaps: studied.gaps, mastered: studied.mastered }, [], ["vous"]).gaps, []);
  });
});
