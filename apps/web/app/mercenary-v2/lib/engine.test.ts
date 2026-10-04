import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptDeal, acceptVolunteer, auditOk, counterDeal, move, netWorth, offerHale, resolveWeek, stageAction, trade } from "./engine";
import { companyHeadcount, createGame } from "./seed";

function runWeeks(state: ReturnType<typeof createGame>, count: number) {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = resolveWeek(next, { stopOnLoss: false });
  }
  return next;
}

describe("hollowmere", () => {
  it("reconciles twelve weeks with no player", () => {
    let state = createGame({ tutorial: false, seed: 7 });
    state.week = 1;
    state.locationId = "crownmarket";
    state = runWeeks(state, 12);
    const audit = auditOk(state);
    assert.equal(audit.bread, true, `bread gap ${audit.breadGap}`);
    assert.equal(audit.gold, true, `gold gap ${audit.goldGap}`);
    assert.equal(audit.people, true);
    assert.ok(state.events.some((event) => event.type === "raid"));
    assert.equal(state.week, 13);
    assert.equal(state.stores.every((store) => store.bread >= 0 && store.gold >= 0), true);
    assert.ok(state.worldEvents.find((event) => event.id === "wolves")?.fired);
    assert.ok(state.worldEvents.find((event) => event.id === "lantern-rebellion")?.fired);
  });

  it("moves gold when Hale's offer is accepted", () => {
    let state = createGame({ tutorial: false, seed: 3 });
    const beforeStore = state.stores.find((store) => store.id === "thorn-store")?.gold ?? 0;
    const before = state.company.gold;
    state = offerHale(state, 30);
    const deal = state.deals[0];
    state = counterDeal(state, deal.id, 40);
    state = acceptDeal(state, deal.id);
    const store = state.stores.find((item) => item.id === "thorn-store");
    assert.equal(state.company.gold, before + 40);
    assert.equal(store?.gold, beforeStore - 40);
    assert.equal(state.quests.find((quest) => quest.id === "quest-camp")?.status, "active");
    assert.equal(auditOk(state).gold, true);
  });

  it("takes recruits out of a group and sends temporary units home", () => {
    let state = createGame({ tutorial: false, seed: 2 });
    state.volunteers.push({
      id: "vol-test",
      groupId: "tw-peasants",
      count: 2,
      skills: "Raw",
      unitType: "spearmen",
      permanence: "permanent",
      wage: 2,
    });
    const before = state.people.filter((person) => person.groupId === "tw-peasants" && person.alive && !person.inForceId).length;
    state = acceptVolunteer(state, "vol-test");
    const after = state.people.filter((person) => person.groupId === "tw-peasants" && person.alive && !person.inForceId).length;
    assert.equal(after, before - 2);
    assert.ok(state.company.units.some((unit) => unit.memberIds.length === 2));

    state.volunteers.push({
      id: "vol-temp",
      groupId: "tw-peasants",
      count: 2,
      skills: "Woods",
      unitType: "trackers",
      permanence: "temporary",
      conditionText: "until the bandit chief is dead",
      leaveRule: { type: "until_dead", forceId: "force-pack" },
      wage: 2,
      special: { name: "Trackers", strengths: "Search", weaknesses: "Line", wage: 2 },
    });
    state = acceptVolunteer(state, "vol-temp");
    const pack = state.forces.find((force) => force.id === "force-pack");
    if (pack) pack.alive = false;
    state = resolveWeek(state, { stopOnLoss: false });
    assert.equal(state.company.units.some((unit) => unit.type === "trackers" && unit.headcount > 0), false);
    assert.equal(state.people.filter((person) => person.groupId === "tw-peasants" && person.inForceId === state.company.forceId).length, 2);
  });

  it("turns the Crown hostile after Salt Ferry is pillaged", () => {
    let state = createGame({ tutorial: false, seed: 4 });
    state.locationId = "salt-ferry";
    for (const person of state.people) {
      if (person.groupId === "sf-guards") person.alive = false;
    }
    state = stageAction(state, { kind: "pillage", locationId: "salt-ferry" });
    state = resolveWeek(state, { stopOnLoss: false });
    assert.equal(state.dispositions.find((item) => item.holderId === "crown" && item.towardId === "company")?.level, "hostile");
    assert.equal(state.pillaged, true);
  });

  it("refuses a move after the action is spent", () => {
    let state = createGame({ tutorial: false, seed: 1 });
    state = stageAction(state, { kind: "hide" });
    const stayed = move(state, "crownmarket");
    assert.equal(stayed.locationId, "thornwick");
  });

  it("scores gold, bread at the capital rate, goods, and debts", () => {
    const state = createGame({ tutorial: false, seed: 1 });
    state.company.gold = 100;
    state.company.bread = 20;
    state.company.goods.push({ id: "pelts", name: "Pelts", qty: 2, valueGold: 5 });
    state.ledger.push({
      id: "debt",
      npcId: "fenn",
      direction: "player_owes",
      amount: 15,
      currency: "gold",
      dueWeek: 4,
      interest: 0,
      note: "Loan",
      status: "open",
    });
    assert.equal(netWorth(state), 100 + 10 + 10 - 15);
  });

  it("wipes a company that never acts, and pays a careful one", () => {
    let idle = createGame({ tutorial: false, seed: 11 });
    idle.week = 1;
    for (let index = 0; index < 8 && !idle.lost; index += 1) idle = resolveWeek(idle, { stopOnLoss: true });
    assert.equal(idle.lost || companyHeadcount(idle) === 0 || idle.company.bread === 0, true);

    let careful = createGame({ tutorial: false, seed: 11 });
    const opened = netWorth(careful);
    careful = offerHale(careful, 40);
    careful = acceptDeal(careful, careful.deals[0].id);
    careful = trade(careful, "fenn", 500, "buy").state;
    careful = move(careful, "thornwood");
    careful = resolveWeek(careful, { stopOnLoss: true });
    for (let index = 0; index < 4 && careful.forces.find((force) => force.id === "force-pack")?.alive && !careful.lost; index += 1) {
      const revealed = careful.forces.find((force) => force.id === "force-pack")?.hidden === false;
      careful = stageAction(
        careful,
        revealed
          ? { kind: "fight", forceId: "force-pack", plan: "Pikes brace on the ridge and the swords cut in from the trees." }
          : { kind: "search", hexId: "tw-3", lookingFor: "bandit camp" },
      );
      careful = resolveWeek(careful, { stopOnLoss: true });
    }
    if (!careful.lost && careful.locationId === "thornwood") careful = move(careful, "thornwick");
    careful = trade(careful, "fenn", 400, "buy").state;
    while (careful.week <= 12 && !careful.lost && !careful.ended) {
      if (careful.locationId === "thornwick" && !careful.actionUsed) careful = stageAction(careful, { kind: "work", job: "fields" });
      careful = resolveWeek(careful, { stopOnLoss: true });
    }
    assert.equal(careful.lost, false);
    assert.ok(companyHeadcount(careful) > 0);
    assert.ok(netWorth(careful) > opened);
  });
});
