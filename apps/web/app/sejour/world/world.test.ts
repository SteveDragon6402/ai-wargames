import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ITEM_BY_ID } from "@/app/epicerie/data/items";
import { lineMentionsName } from "../components/Conversation";
import { FRISBEE_DIRS, pickNextFrisbeeDir } from "../components/Outing";
import { PEOPLE } from "../data/people";
import { pendingEvent } from "./events";
import { evaluate, newlyPassed, type Progress } from "./gates";
import { RECIPES, suggestRecipe, UTENSILS } from "./recipes";
import { baselineRatingsFromLines, capListening, cleanRatings } from "./skills";
import { cleanStageCall, filterInvite, filterSuggestedPlaces } from "./stage";
import { topUpWallet } from "./wallet";

describe("unlock gates", () => {
  it("keeps everything locked on a fresh stay", () => {
    const empty: Progress = { assessments: [], visits: {}, eventsDone: [] };
    const res = evaluate(empty);
    assert.deepEqual(res.gates, []);
    assert.deepEqual(res.unlocked, []);
  });

  it("unlocks boulangerie first after introducing yourself, and respects teacherUnlocked", () => {
    const p: Progress = {
      assessments: [{ scene: "host", day: 0, ratings: { intro: 2 } }],
      visits: {},
      eventsDone: [],
    };
    const res = evaluate(p);
    assert.deepEqual(res.gates, ["intro"]);
    assert.deepEqual(res.unlocked, ["boulangerie"]);
    assert.equal(newlyPassed(p, [])[0]?.id, "intro");
    assert.equal(newlyPassed(p, ["intro"]).length, 0);

    const withTeacher = evaluate({ ...p, teacherUnlocked: ["boulangerie", "speedfriending"] });
    assert.deepEqual(withTeacher.unlocked, ["boulangerie", "speedfriending"]);
  });

  it("unlocks epicerie after ordering at the boulangerie, while supermarche unlocks much later", () => {
    const wrongScene: Progress = {
      assessments: [{ scene: "host", day: 1, ratings: { ordering: 3 } }],
      visits: {},
      eventsDone: [],
    };
    assert.ok(!evaluate(wrongScene).unlocked.includes("epicerie"));

    const once: Progress = {
      assessments: [{ scene: "boulangerie", day: 1, ratings: { ordering: 2 } }],
      visits: { boulangerie: 1 },
      eventsDone: [],
    };
    assert.ok(evaluate(once).unlocked.includes("epicerie"));
    assert.ok(!evaluate(once).unlocked.includes("supermarche"));

    const later: Progress = {
      assessments: [
        { scene: "host", day: 0, ratings: { intro: 2 } },
        { scene: "boulangerie", day: 1, ratings: { ordering: 2 } },
        { scene: "epicerie", day: 2, ratings: { ordering: 2, food: 2 } },
        { scene: "epicerie", day: 3, ratings: { ordering: 3, food: 3 } },
      ],
      visits: { boulangerie: 1, epicerie: 2 },
      eventsDone: [],
    };
    assert.ok(evaluate(later).unlocked.includes("supermarche"));
  });

  it("unlocks invitations after speedfriending smalltalk, and chains events", () => {
    const p: Progress = {
      assessments: [
        { scene: "speedfriending", day: 1, ratings: { smalltalk: 2, intro: 2 } },
        { scene: "speedfriending", day: 2, ratings: { smalltalk: 3, register: 3 } },
        { scene: "boulangerie", day: 2, ratings: { ordering: 3, numbers: 2 } },
        { scene: "epicerie", day: 3, ratings: { ordering: 3, food: 3 } },
      ],
      visits: { boulangerie: 1, epicerie: 2, bistro: 1 },
      eventsDone: [],
    };
    const res = evaluate(p);
    assert.ok(res.unlocked.includes("invite_parc"));
    assert.ok(res.unlocked.includes("invite_cinema"));
    assert.ok(res.unlocked.includes("invite_sport"));
    assert.ok(res.unlocked.includes("bistro"));
    assert.ok(res.unlocked.includes("supermarche"));
    assert.ok(res.unlocked.includes("event_family"));
    // Sick event needs family event done first
    assert.ok(!res.unlocked.includes("event_sick"));
    // Events do not trigger on day 1 even when unlocked; they wait until later days
    assert.equal(pendingEvent(res.unlocked, [], 1), null);
    assert.equal(pendingEvent(res.unlocked, [], 3), "family");
  });
});

describe("character portraits and ??? name reveal", () => {
  it("gives every villager a unique portrait distinct from Madame Rousseau and reveals ??? names only when spoken", () => {
    const portraits = PEOPLE.map((p) => p.portrait);
    assert.equal(new Set(portraits).size, portraits.length);
    assert.ok(!portraits.includes("/sejour/rousseau.jpg"));
    assert.ok(!portraits.includes("/sejour/people/nadine.jpg"));

    assert.equal(lineMentionsName("Bonjour, bienvenue chez moi !", "Madame Rousseau"), false);
    assert.equal(lineMentionsName("Je m'appelle Madame Rousseau.", "Madame Rousseau"), true);
    assert.equal(lineMentionsName("Bonjour, je suis Monsieur Moreau, le pharmacien.", "Monsieur Moreau"), true);
    assert.equal(lineMentionsName("Bienvenue à la boulangerie !", "Martine"), false);
    assert.equal(lineMentionsName("Bienvenue chez Martine !", "Martine"), true);

    assert.equal(FRISBEE_DIRS.left.callFr, "À gauche !");
    assert.equal(FRISBEE_DIRS.right.pointText, "points towards your right");
    assert.notEqual(pickNextFrisbeeDir("left", 1), "left");
  });
});

describe("recipes and cooking steps", () => {
  it("chains every cooking step from grocery items and utensils", () => {
    assert.equal(RECIPES.length, 5);
    for (const recipe of RECIPES) {
      const available = new Set<string>(recipe.lines.map((line) => line.itemId));
      for (const line of recipe.lines) {
        assert.ok(ITEM_BY_ID[line.itemId], `unknown grocery item ${line.itemId}`);
      }
      for (const u of recipe.utensils) {
        assert.ok(UTENSILS[u], `unknown utensil ${u}`);
      }
      for (const step of recipe.steps) {
        assert.ok(available.has(step.item), `recipe ${recipe.id} step needs ${step.item} before it exists`);
        assert.ok(recipe.utensils.includes(step.into), `recipe ${recipe.id} uses utensil ${step.into} not on counter`);
        available.add(step.result);
      }
    }
    assert.equal(suggestRecipe([]).id, "tartines");
    assert.equal(suggestRecipe(["tartines"]).id, "eggs");
  });
});

describe("wallet and ratings", () => {
  it("tops up wallet only when short and clamps skill ratings to 0..4", () => {
    const first = topUpWallet([], "boulangerie");
    assert.ok(first.added >= 600);
    const second = topUpWallet(first.wallet, "boulangerie");
    assert.equal(second.added, 0);

    const cleaned = cleanRatings({ intro: 2.4, ordering: 9, register: -2, unknown: 3 });
    assert.deepEqual(cleaned, { intro: 2, ordering: 4, register: 0 });

    const baseline = baselineRatingsFromLines("host", ["Bonjour madame, je m'appelle Alex, je viens de Londres"], {});
    assert.equal(baseline.intro, 2);
    assert.equal(baseline.register, 2);
    const typed = baselineRatingsFromLines("host", ["hello there", "what is for dinner"], {});
    assert.equal(typed.listening, undefined);
    assert.equal(typed.intro, undefined);
    assert.equal(capListening({ listening: 3, intro: 2 }, true).listening, 1);
    assert.equal(capListening({ listening: 3 }, false).listening, 3);
  });

  it("filters suggested places, invites, and stage calls against unlocked state", () => {
    assert.deepEqual(filterSuggestedPlaces(["boulangerie", "epicerie", "nope"], ["boulangerie"]), ["boulangerie"]);
    assert.equal(filterInvite("parc", []), null);
    assert.equal(filterInvite("parc", ["invite_parc"]), "parc");
    assert.deepEqual(cleanStageCall({ kind: "image", id: "baguette" }), { kind: "image", id: "baguette" });
    assert.equal(cleanStageCall({ kind: "invalid", id: "x" }), null);
  });
});
