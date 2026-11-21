import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addBookPage, addPhrase, emptySave, movePhrase, offerPlaces, parseSave, recordAssessment, recordStudy, recordVisit } from "./save";

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
  it("migrates v1, reads v2, and refuses the shop's save", () => {
    const save = { ...emptySave(), day: 2, address: "madame" as const, cooked: ["eggs"] };
    assert.equal(parseSave(save)?.day, 2);
    assert.equal(parseSave(save)?.version, 2);
    // Migrates v1
    const fromV1 = parseSave({ version: 1, address: "monsieur", day: 3, phrases: [{ id: "1", fr: "Salut.", en: "Hi.", source: "you", day: 1 }] });
    assert.equal(fromV1?.version, 2);
    assert.equal(fromV1?.address, "monsieur");
    assert.equal(fromV1?.phrases.length, 1);
    // Rejects shop save (has numeric visits + carnet)
    assert.equal(parseSave({ version: 1, address: "monsieur", day: 0, visits: 3, carnet: [] }), null);
    assert.equal(parseSave(null), null);
    assert.equal(parseSave({ version: 99, day: 0 }), null);
    assert.equal(parseSave({ version: 1, day: -1 }), null);
    const studied = recordStudy(emptySave(), [{ id: "vous", note: "tu with the shopkeeper" }], ["je"]);
    assert.deepEqual(studied.mastered, ["je"]);
    assert.equal(studied.gaps[0]?.id, "vous");
    assert.deepEqual(recordStudy({ ...emptySave(), gaps: studied.gaps, mastered: studied.mastered }, [], ["vous"]).gaps, []);
  });

  it("unlocks places through assessments and only offers unlocked places", () => {
    let save = emptySave();
    assert.ok(save.unlocked.includes("boulangerie"));
    save = offerPlaces(save, ["boulangerie", "epicerie"]);
    assert.deepEqual(save.offered, ["boulangerie"]);

    save = recordAssessment(save, { scene: "host", day: 0, ratings: { intro: 2 } });
    assert.ok(save.unlocked.includes("boulangerie"));
    assert.ok(!save.unlocked.includes("speedfriending"));

    save = recordAssessment(save, { scene: "boulangerie", day: 1, ratings: { ordering: 2 } });
    assert.ok(save.unlocked.includes("epicerie"));
    assert.ok(save.unlocked.includes("speedfriending"));
    save = offerPlaces(save, ["boulangerie", "epicerie"]);
    assert.ok(save.offered.includes("boulangerie"));
    assert.ok(save.offered.includes("epicerie"));

    save = recordVisit(save, "epicerie");
    assert.ok(save.unlocked.includes("bistro"));
    assert.ok(!save.unlocked.includes("supermarche"));
  });

  it("keeps grammar lesson ids and remembers when the learner read the words", () => {
    const parsed = parseSave({
      ...emptySave(),
      listeningMode: "off",
      readText: true,
      gaps: [{ id: "w3d17_questions_est_ce_que", note: "Ask with est-ce que." }],
    });
    assert.equal(parsed?.listeningMode, "off");
    assert.equal(parsed?.listening, false);
    assert.equal(parsed?.readText, true);
    assert.equal(parsed?.gaps[0]?.id, "w3d17_questions_est_ce_que");
    assert.equal(parseSave({ ...emptySave(), listening: true })?.listeningMode, "on");
  });
});
