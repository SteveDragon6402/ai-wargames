import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventsFromResolvedOrders } from "./faction-events";
import { army, holdRuntime } from "./test-helpers";

describe("eventsFromResolvedOrders", () => {
  it("describes fortify-while-investing as digging in around the walls", () => {
    const host = army({
      id: "w1",
      name: "The Kingslayer's Host",
      faction: "westerlands",
      holdId: "16",
    });
    const events = eventsFromResolvedOrders(
      4,
      [host],
      [],
      [],
      {},
      { w1: "fortify" },
      {
        "16": holdRuntime({
          controller: "north",
          siege: {
            besiegerFaction: "westerlands",
            turns: 2,
            armyIds: ["w1"],
          },
        }),
      }
    );
    assert.equal(events.length, 1);
    assert.match(events[0].summary, /siege lines around/i);
    assert.match(events[0].detail, /not occupying the castle/i);
    assert.match(events[0].detail, /sally/i);
    assert.doesNotMatch(events[0].summary, /fortified at/i);
  });

  it("keeps ordinary fortify wording when the host is not investing", () => {
    const host = army({
      id: "n1",
      name: "Stark Host",
      faction: "north",
      holdId: "01",
    });
    const events = eventsFromResolvedOrders(
      2,
      [host],
      [],
      [],
      { n1: "fortify" },
      {},
      { "01": holdRuntime({ controller: "north", siege: null }) }
    );
    assert.equal(events.length, 1);
    assert.match(events[0].summary, /fortified at/i);
  });
});
