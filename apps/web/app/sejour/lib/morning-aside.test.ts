import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bakeryErrandForDay, hostMorningAside } from "./morning-aside";

const morning = "MORNING. Day 1. Breakfast.";

describe("the morning aside", () => {
  it("stays off the evening and the shops", () => {
    assert.equal(hostMorningAside({ context: "ARRIVAL. First evening.", name: "Aryan", places: ["boulangerie"] }), "");
    assert.equal(hostMorningAside({ context: "At the till.", name: "Aryan", places: ["boulangerie"] }), "");
  });

  it("on day 1, talks first and then sends them for one bakery item", () => {
    const item = bakeryErrandForDay(1);
    const aside = hostMorningAside({ context: morning, name: "Aryan Shah", places: ["boulangerie"] });
    assert.match(aside, /Don't say this out loud/);
    assert.match(aside, /made Aryan feel comfortable/);
    assert.match(aside, /discussed some basics/);
    assert.match(aside, /Greetings/);
    assert.match(aside, /send them to the boulangerie/);
    assert.match(aside, new RegExp(item.fr));
    assert.match(aside, /suggest_place with boulangerie/);
    assert.equal(aside.includes("what they want to do today"), false);
  });

  it("keeps the same pastry for the day", () => {
    assert.equal(bakeryErrandForDay(1).fr, bakeryErrandForDay(1).fr);
    assert.notEqual(bakeryErrandForDay(1).fr, bakeryErrandForDay(2).fr);
  });

  it("on a later morning, asks them to choose from the open places", () => {
    const aside = hostMorningAside({
      context: "MORNING. Day 5. Breakfast.",
      name: "Aryan",
      places: ["boulangerie", "epicerie", "bistro"],
    });
    assert.match(aside, /ask them what they want to do today/);
    assert.match(aside, /1\. the boulangerie/);
    assert.match(aside, /2\. the épicerie/);
    assert.match(aside, /3\. the bistro/);
    assert.match(aside, /suggest_place/);
    assert.match(aside, /Avoir/);
  });

  it("treats a visitor or an illness as the morning", () => {
    const lunch = hostMorningAside({
      context: "MORNING. Day 18. Breakfast.",
      name: "Aryan",
      places: ["boulangerie", "epicerie"],
      event: "family",
    });
    assert.match(lunch, /Camille/);
    assert.equal(lunch.includes("what they want to do today"), false);

    const sick = hostMorningAside({
      context: "MORNING. Day 25. Breakfast.",
      name: "Aryan",
      places: ["boulangerie"],
      event: "sick",
    });
    assert.match(sick, /pharmacie/);
    assert.equal(sick.includes("suggest_place"), false);
  });
});
