import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distance, groupCount, NAMED, openingWorld, PLACES, type GroupId } from "../data/hollowmere";
import { books, storeOf } from "./books";
import { EAT } from "../data/tuning";
import { foundCompany, freshGame, headcount, living, resolveWeek, runWeeks } from "./sim";

const COUNTS: [GroupId, number][] = [
  ["crown-peasants", 160],
  ["crown-guards", 30],
  ["crown-nobles", 10],
  ["ferry-peasants", 22],
  ["ferry-guards", 3],
  ["thorn-peasants", 22],
  ["thorn-guards", 2],
  ["lantern-brothers", 6],
  ["pack", 18],
];

describe("hollowmere map", () => {
  it("keeps Thornwood two weeks from Crownmarket, and the ferry off Thornwick", () => {
    assert.equal(distance("crownmarket", "thornwood"), 2);
    assert.notEqual(distance("salt-ferry", "thornwick"), 1);
    assert.notEqual(distance("crownmarket", "thornwick"), 1);
    assert.equal(PLACES.crownmarket.rate, 2);
    assert.equal(PLACES["lantern-house"].rate, 2.5);
    assert.equal(PLACES["salt-ferry"].rate, 3);
    assert.equal(PLACES.thornwick.rate, 3.5);
    assert.equal(PLACES.thornwood.rate, null);
  });
});

describe("census", () => {
  it("opens at 273 living rows with the named people inside the counts", () => {
    const world = openingWorld();
    assert.equal(world.people.length, 273);
    assert.equal(world.people.filter((person) => person.alive).length, 273);
    for (const [id, count] of COUNTS) assert.equal(groupCount(world.people, id), count);
    for (const id of Object.keys(NAMED) as (keyof typeof NAMED)[]) {
      const row = world.people.find((person) => person.npcId === id);
      assert.ok(row, id);
      assert.equal(row?.name, NAMED[id].name);
    }
    assert.equal(storeOf(world, "civic").bread, 7000);
    assert.equal(storeOf(world, "civic").gold, 2000);
    assert.equal(storeOf(world, "ferry").bread, 875);
    assert.equal(storeOf(world, "ferry").gold, 120);
    assert.equal(storeOf(world, "thornwick").bread, 580);
    assert.equal(storeOf(world, "thornwick").gold, 120);
    assert.equal(storeOf(world, "lantern").bread, 300);
    assert.equal(storeOf(world, "lantern").gold, 600);
    assert.equal(world.pack.bread, 250);
    assert.equal(world.pack.gold, 300);
    assert.equal(world.people.filter((person) => person.groupId === "pack").every((person) => person.bread === 0), true);
  });
});

describe("books", () => {
  it("matches the census, and a transfer does not change the total", () => {
    const world = openingWorld();
    const open = books(world);
    let bread = world.pack.bread;
    let gold = world.pack.gold;
    for (const person of world.people) {
      bread += person.bread;
      gold += person.gold;
    }
    for (const store of world.stores) {
      bread += store.bread;
      gold += store.gold;
    }
    assert.equal(open.bread, bread);
    assert.equal(open.gold, gold);
    const moved = structuredClone(world);
    storeOf(moved, "civic").gold -= 5;
    moved.pack.gold += 5;
    assert.equal(books(moved).gold, open.gold);
    assert.equal(books(moved).bread, open.bread);
  });
});

describe("a quiet week", () => {
  it("eats seven bread a person and pays the guards from the stores", () => {
    const open = openingWorld();
    const before = books(open);
    const week = resolveWeek(open, { raids: false, plots: false });
    assert.equal(week.people.filter((person) => !person.alive).length, 0);
    for (const person of week.people) {
      if (person.groupId === "pack") {
        assert.equal(person.bread, 0);
        continue;
      }
      const was = open.people.find((row) => row.id === person.id);
      assert.equal(person.bread, (was?.bread ?? 0) - EAT);
    }
    assert.equal(week.pack.bread, 250 - EAT * 18);
    assert.equal(storeOf(week, "civic").bread, 7000);
    assert.equal(storeOf(week, "thornwick").bread, 580);
    assert.equal(storeOf(week, "ferry").bread, 875);
    assert.equal(storeOf(week, "civic").gold, 1910);
    assert.equal(storeOf(week, "thornwick").gold, 118);
    assert.equal(storeOf(week, "ferry").gold, 117);
    assert.equal(books(week).bread, before.bread - EAT * 273);
    assert.equal(books(week).gold, before.gold);
  });
});

describe("company upkeep", () => {
  it("pays the first week and then deserts on the unpaid schedule", () => {
    let world = foundCompany(openingWorld());
    const opts = { raids: false, plots: false };
    world = resolveWeek(world, opts);
    assert.equal(world.company?.bread, 0);
    assert.equal(world.company?.units[0]?.morale, 70);
    assert.equal(headcount(world.company), 20);
    world = resolveWeek(world, opts);
    assert.equal(world.company?.units[0]?.morale, 55);
    world = resolveWeek(world, opts);
    assert.equal(world.company?.units[0]?.morale, 40);
    world = resolveWeek(world, opts);
    assert.equal(world.company?.units[0]?.morale, 25);
    assert.equal(headcount(world.company), 20);
    world = resolveWeek(world, opts);
    assert.equal(world.company?.units[0]?.morale, 10);
    assert.equal(headcount(world.company), 18);
  });
});

describe("plot clock", () => {
  it("takes forty bread from the Salt Ferry from week 3, and stops the week after the wolves die", () => {
    let world = openingWorld();
    world = runWeeks(world, 2, { raids: false });
    assert.equal(world.week, 3);
    assert.equal(storeOf(world, "ferry").bread, 875);
    world = resolveWeek(world, { raids: false });
    assert.equal(storeOf(world, "ferry").bread, 835);
    world.wolvesAlive = false;
    const held = storeOf(world, "ferry").bread;
    world = resolveWeek(world, { raids: false });
    assert.equal(storeOf(world, "ferry").bread, held);
  });

  it("places the Thornback in week 9 and kills one Thornwick peasant from week 10", () => {
    let world = openingWorld();
    world = runWeeks(world, 8, { raids: false });
    assert.equal(world.week, 9);
    world = resolveWeek(world, { raids: false });
    assert.equal(world.thornback.placed, true);
    assert.equal(world.thornback.hidden, true);
    assert.equal(world.thornback.found, false);
    assert.equal(groupCount(world.people, "thorn-peasants"), 22);
    world = resolveWeek(world, { raids: false });
    assert.equal(groupCount(world.people, "thorn-peasants"), 21);
  });

  it("raises the faith militia in week 10 and applies the ignored fight", () => {
    let world = openingWorld();
    world = runWeeks(world, 9, { raids: false });
    world = resolveWeek(world, { raids: false });
    assert.equal(groupCount(world.people, "crown-peasants"), 135);
    assert.equal(groupCount(world.people, "faith-militia"), 15);
    assert.equal(groupCount(world.people, "crown-guards"), 22);
    assert.equal(world.people.find((person) => person.npcId === "aldous")?.alive, true);
    const face = world.dispositions.find((item) => item.holder === "lantern-house" && item.toward === "crown");
    assert.equal(face?.level, "Hostile");
  });
});

describe("a raid", () => {
  it("moves eighty bread and ten gold, then the Pack eats", () => {
    const open = openingWorld();
    const week = resolveWeek(open, { plots: false });
    assert.equal(week.trace[0]?.raided, true);
    assert.equal(week.trace[0]?.raidBread, 80);
    assert.equal(storeOf(week, "thornwick").bread, 500);
    assert.equal(week.pack.bread, 250 + 80 - EAT * 17);
    assert.equal(groupCount(week.people, "thorn-guards"), 1);
    assert.equal(groupCount(week.people, "pack"), 17);
    assert.equal(groupCount(week.people, "thorn-peasants"), 22);
    assert.equal(week.people.find((person) => person.npcId === "corwin")?.alive, true);
  });
});

describe("twelve weeks", () => {
  it("keeps an empty spring moving without inventing bread", () => {
    const open = openingWorld();
    const end = runWeeks(open, 12);
    assert.equal(end.trace.length, 12);
    const startGold = books(open).gold;
    let bread = books(open).bread;
    let raids = 0;
    for (const line of end.trace) {
      assert.equal(line.gold, startGold);
      assert.ok(line.bread >= 0);
      assert.equal(line.bread, bread - line.eaten - line.wolfLoss);
      bread = line.bread;
      if (line.raided) raids += 1;
      assert.ok(line.thornGuards >= 0);
    }
    assert.ok(raids >= 2);
    assert.equal(end.trace[2]?.wolfLoss, 40);
    assert.equal(end.trace[9]?.crownPeasants, 135);
    assert.equal(end.trace[8]?.thornbackAlive, true);
    assert.ok(end.trace[9] && end.trace[9].ferryBread < end.trace[0]!.ferryBread);
    const earlyPeasants = end.trace.slice(0, 7).every((line) => line.crownPeasants === 160 || line.week < 10);
    assert.equal(earlyPeasants, true);
    assert.ok(end.trace[6]!.thornBread > 0 || end.trace.filter((line) => line.raided).length >= 6);
    const thornPeasantsWeek7 = groupCount(
      runWeeks(open, 7).people,
      "thorn-peasants",
    );
    assert.ok(thornPeasantsWeek7 > 0);
  });

  it("does not raid Thornwick while the company sits there", () => {
    const open = foundCompany(openingWorld());
    const end = runWeeks(open, 12);
    assert.ok(end.trace.every((line) => !line.raided));
    assert.ok(end.trace.every((line) => line.thornGuards === 2));
    assert.equal(end.trace[0]?.companyBread, 0);
    assert.equal(end.trace[0]?.companyMorale, 70);
    assert.equal(end.trace[4]?.companyMorale, 10);
    assert.equal(end.trace[4]?.companyMen, 18);
    assert.ok((end.trace[2]?.packBread ?? 1) === 0 || (end.trace[3]?.packAlive ?? 1) < 18);
  });
});

describe("loss", () => {
  it("ends the run at no soldiers, and the dead do not eat", () => {
    let world = foundCompany(openingWorld());
    world.company!.units[0]!.headcount = 0;
    world.company!.units[1]!.headcount = 0;
    world = resolveWeek(world, { raids: false, plots: false });
    assert.equal(world.lost, true);

    const quiet = openingWorld();
    const marked = quiet.people.filter((person) => person.groupId === "crown-peasants" && !person.npcId).slice(0, 3);
    for (const person of marked) {
      person.alive = false;
      person.bread = 95;
    }
    const after = resolveWeek(quiet, { raids: false, plots: false });
    for (const person of marked) {
      const row = after.people.find((item) => item.id === person.id);
      assert.equal(row?.bread, 95);
      assert.equal(row?.alive, false);
    }
    assert.equal(living(after).some((person) => person.id === marked[0]?.id), false);
  });
});

describe("a new game", () => {
  it("starts unfounded in Thornwick", () => {
    const game = freshGame();
    assert.equal(game.week, 1);
    assert.equal(game.company?.location, "thornwick");
    assert.equal(game.company?.founded, false);
    assert.equal(game.people.length, 273);
  });
});
