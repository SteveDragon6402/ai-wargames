import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupCount, type World } from "../data/hollowmere";
import { storeOf } from "./books";
import {
  acceptChip,
  acceptDeal,
  acceptRecruits,
  addRumours,
  advanceTutorial,
  applyFight,
  applyFind,
  blend,
  canvasAllowed,
  closeYear,
  confirmSuggestion,
  counterDeal,
  createQuest,
  declineDeal,
  declineForce,
  decisionsKnownTo,
  dismissChip,
  earnedSealIds,
  found,
  guardDuty,
  hide,
  ignoreSuggestion,
  marchPursuit,
  merchantGuard,
  netWorth,
  offerDeal,
  regardPrompt,
  offerRecruits,
  openingFlags,
  pillage,
  publicView,
  raisePursuit,
  recallPursuit,
  refuge,
  releaseTemporary,
  resolveFind,
  rest,
  reviveSave,
  sealName,
  searchHistoryLine,
  searchPrompt,
  setChip,
  skipTutorial,
  suggest,
  visibleSeals,
  workFields,
} from "./play";
import { freshGame, resolveWeek } from "./sim";
import { START_CONDITION as CONDITION } from "../data/tuning";

function company(): World {
  const made = found(freshGame(), {
    name: "The Grey Company",
    origin: "Raised on the road.",
    colours: ["azure", "sable"],
    sigil: "spear",
    captainName: "Harl",
    captainBackground: "Deserter",
    trades: ["spearmen", "swordsmen"],
    unitNames: ["The File", "The Bows"],
  });
  if (!made.ok) throw new Error(made.error);
  return made.world;
}

describe("the page model", () => {
  it("shows the purse and the deal, and not the books", () => {
    let world = company();
    const offered = offerDeal(world, "hale", 30, "gold", 4);
    assert.equal(offered.ok, true);
    if (!offered.ok) return;
    const view = publicView(offered.world);
    assert.equal(view.gold, 120);
    assert.equal(view.bread, 280);
    assert.equal(view.weekMax, 12);
    assert.equal(view.deals[0]?.amount, 30);
    assert.equal("stores" in view, false);
    assert.equal(JSON.stringify(view).includes("7000"), false);
    const gold = offered.world.company!.gold;
    const countered = counterDeal(offered.world, offered.world.deals[0]!.id, 40);
    assert.equal(countered.ok, true);
    if (!countered.ok) return;
    assert.equal(countered.world.company!.gold, gold);
    assert.equal(countered.world.deals[0]?.status, "countering");
    const declined = declineDeal(offered.world, offered.world.deals[0]!.id);
    assert.equal(declined.ok, true);
    if (!declined.ok) return;
    assert.equal(declined.world.deals.length, 0);
    const accepted = acceptDeal(offered.world, offered.world.deals[0]!.id);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.world.company!.gold, 150);
    assert.equal(offerDeal(world, "hale", 1000, "gold", 4).ok, false);
  });

  it("ignores a suggestion until it is confirmed", () => {
    let world = suggest(company(), "Search the wood.", "search");
    const ignored = ignoreSuggestion(world);
    assert.equal(ignored.suggestion, null);
    assert.equal(ignored.company!.actionUsed, false);
    world = suggest(world, "Search the wood.", "search");
    const confirmed = confirmSuggestion(world);
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    assert.equal(confirmed.world.company!.actionUsed, true);
  });
});

describe("founding and regard", () => {
  it("rejects a bad founding and keeps the spec's purse", () => {
    const base = freshGame();
    const input = {
      name: "The Grey Company",
      origin: "Raised on the road.",
      colours: ["azure", "sable"] as [string, string],
      sigil: "spear" as const,
      captainName: "Harl",
      captainBackground: "Deserter" as const,
      trades: ["spearmen", "swordsmen"] as ["spearmen", "swordsmen"],
      unitNames: ["The File", "The Bows"] as [string, string],
    };
    assert.equal(found(base, { ...input, name: " " }).ok, false);
    assert.equal(found(base, { ...input, colours: ["red", "sable"] }).ok, false);
    assert.equal(found(base, { ...input, trades: ["spearmen", "spearmen"] }).ok, false);
    assert.equal(found(base, { ...input, unitNames: ["The File", "The File"] }).ok, false);
    const made = found(base, input);
    assert.equal(made.ok, true);
    if (!made.ok) return;
    assert.equal(made.world.company?.gold, 120);
    assert.equal(made.world.company?.bread, 280);
    assert.equal(made.world.company?.units.reduce((sum, unit) => sum + unit.headcount, 0), 20);
    assert.equal(made.world.company?.units.length, 2);
    const prompt = regardPrompt(made.world.company!);
    assert.match(prompt, /The Grey Company/);
    assert.match(prompt, /azure/);
    assert.match(prompt, /sable/);
    assert.match(prompt, /spear/);
    assert.match(prompt, /spearmen/);
    assert.match(prompt, /swordsmen/);
    assert.doesNotMatch(prompt, /\bplayer\b/i);
  });
});

describe("flags, chips, and memory", () => {
  it("flags Hale in Thornwick and nobody in a quiet Crownmarket", () => {
    const world = company();
    world.decisions = [];
    const flags = openingFlags(world);
    assert.equal(flags.find((flag) => flag.who === "hale")?.wants, true);
    assert.equal(flags.filter((flag) => ["aldous", "varrow", "oskar", "benet", "pell"].includes(flag.who)).every((flag) => !flag.wants), true);
    let chipped = setChip(world, { label: "Perform recruit action?", action: "recruit" });
    const dismissed = dismissChip(chipped);
    assert.equal(dismissed.intentChip, null);
    assert.equal(dismissed.company!.actionUsed, false);
    chipped = setChip(world, { label: "Perform recruit action?", action: "recruit" });
    const taken = acceptChip(chipped);
    assert.equal(taken.ok, true);
    if (!taken.ok) return;
    assert.equal(taken.world.company!.actionUsed, true);
  });

  it("lets Thornwick men tell Thornwick, and not Crownmarket", () => {
    let world = company();
    assert.equal(decisionsKnownTo(world, "thornwick").length, 0);
    const hired = acceptRecruits(world, "thorn-peasants", 1, "archers");
    assert.equal(hired.ok, true);
    if (!hired.ok) return;
    world = hired.world;
    world.decisions.push({ week: world.week, text: "They found the camp." });
    assert.equal(decisionsKnownTo(world, "thornwick").some((item) => /camp/.test(item.text)), true);
    world.company!.location = "crownmarket";
    assert.equal(decisionsKnownTo(world, "crownmarket").some((item) => /camp/.test(item.text)), false);
  });
});

describe("recruiting", () => {
  it("caps the offer, fills a unit, and blends the newcomers", () => {
    const world = company();
    assert.equal(offerRecruits(world, "thorn-peasants", 40), 22);
    assert.equal(blend(10, 70, 10, 55), 62.5);
    world.company!.units = [{ ...world.company!.units[0]!, trade: "spearmen", headcount: 8, morale: 70, condition: 80 }];
    const filled = acceptRecruits(world, "thorn-peasants", 4, "spearmen");
    assert.equal(filled.ok, true);
    if (!filled.ok) return;
    const counts = filled.world.company!.units.map((unit) => unit.headcount).sort((a, b) => b - a);
    assert.deepEqual(counts, [10, 2]);
    assert.equal(groupCount(world.people, "thorn-peasants") - groupCount(filled.world.people, "thorn-peasants"), 4);
    const special = acceptRecruits(company(), "thorn-peasants", 3, "spearmen", "permanent", null, {
      name: "Trackers",
      strengths: "They know the paths.",
      weaknesses: "They are not soldiers.",
    });
    assert.equal(special.ok, true);
    if (!special.ok) return;
    assert.equal(special.world.wiki.length, 1);
    assert.equal(special.world.company!.units.length, 3);
  });

  it("will not canvas in the wood or a hostile square", () => {
    const world = company();
    world.company!.location = "thornwood";
    assert.equal(canvasAllowed(world, "pack"), false);
    world.company!.location = "crownmarket";
    world.company!.units[0]!.headcount = 8;
    world.dispositions.push({ holder: "crown-peasants", toward: "company", level: "Hostile", description: "No.", score: -20 });
    assert.equal(canvasAllowed(world, "crown-peasants"), false);
  });

  it("sends temporary men home", () => {
    const hired = acceptRecruits(company(), "thorn-peasants", 2, "archers", "temporary", "until the bandit chief is dead");
    assert.equal(hired.ok, true);
    if (!hired.ok) return;
    hired.world.people.find((person) => person.npcId === "corwin")!.alive = false;
    const home = releaseTemporary(hired.world);
    assert.equal(home.company!.units.some((unit) => unit.leaveCondition?.includes("bandit chief")), false);
    assert.equal(home.people.filter((person) => person.forceId === "company" && person.groupId === "thorn-peasants").length, 0);
    const timed = acceptRecruits(company(), "ferry-peasants", 2, "archers", "temporary", "for 3 weeks");
    assert.equal(timed.ok, true);
    if (!timed.ok) return;
    timed.world.week = 4;
    const back = releaseTemporary(timed.world);
    assert.equal(back.company!.units.some((unit) => unit.leaveCondition === "for 3 weeks"), false);
    assert.equal(back.people.find((person) => person.npcId === "corwin")?.alive, true);
  });
});

describe("fights and pursuit", () => {
  it("does not capture men who got away, and the dead do not eat", () => {
    const world = company();
    const marked = world.people.filter((person) => person.groupId === "crown-peasants" && !person.npcId).slice(0, 3);
    const bread = marked.map((person) => person.bread);
    const fought = applyFight(world, { killed: 3, wounded: 1, inHand: 0, atLarge: 5, group: "crown-peasants" });
    assert.equal(fought.stood, true);
    assert.equal(fought.world.company!.location, "thornwick");
    assert.equal(fought.world.people.some((person) => person.alive && person.groupId === "pack"), true);
    const after = resolveWeek(fought.world, { raids: false, plots: false });
    marked.forEach((person, index) => {
      const row = after.people.find((item) => item.id === person.id);
      assert.equal(row?.alive, false);
      assert.equal(row?.bread, bread[index]);
    });
  });

  it("leaves a captive alive when the pack pot is empty", () => {
    const world = company();
    const row = world.people.find((person) => person.groupId === "pack" && !person.npcId);
    assert.ok(row);
    if (!row) return;
    row.forceId = "captive";
    world.pack.bread = 0;
    const after = resolveWeek(world, { raids: false, plots: false, upkeep: false });
    assert.equal(after.people.find((person) => person.id === row.id)?.alive, true);
    assert.equal(
      after.people.some((person) => person.groupId === "pack" && !person.npcId && person.forceId !== "captive" && !person.alive),
      true,
    );
  });

  it("takes a new captive each time, and leaves the last one in hand", () => {
    const world = company();
    const first = applyFight(world, { killed: 0, wounded: 0, inHand: 1, atLarge: 0, group: "pack" });
    const second = applyFight(first.world, { killed: 0, wounded: 0, inHand: 1, atLarge: 0, group: "pack" });
    const held = second.world.people.filter((person) => person.alive && person.forceId === "captive");
    assert.equal(held.length, 2);
    assert.equal(new Set(held.map((person) => person.id)).size, 2);
  });

  it("opens a battle instead of looting when the company is in Thornwick", () => {
    const world = company();
    const week = resolveWeek(world, { plots: false, raidAsBattle: true });
    assert.equal(week.pendingBattle?.kind, "raid");
    assert.equal(storeOf(week, "thornwick").bread, 580);
  });

  it("refuses to pillage past living guards", () => {
    const world = company();
    assert.equal(pillage(world, "thornwick").ok, false);
    for (const person of world.people) if (person.groupId === "thorn-guards") person.alive = false;
    const sack = pillage(world, "thornwick");
    assert.equal(sack.ok, true);
    if (!sack.ok) return;
    assert.equal(sack.world.dispositions.find((item) => item.holder === "crown" && item.toward === "company")?.level, "Hostile");
    assert.ok((sack.world.company?.bread ?? 0) > 280);
  });

  it("raises a pursuit, marches it, and recalls it", () => {
    let world = company();
    world.company!.lastSeen = "thornwick";
    world = raisePursuit(world, "crown");
    const force = world.pursuits[0];
    assert.ok(force && force.personIds.length > 0);
    const hidden = hide(world);
    hidden.company!.location = "lantern-house";
    const quiet = marchPursuit(hidden, force!.id, "lantern-house");
    assert.equal(quiet.pendingBattle, null);
    const seen = marchPursuit(world, force!.id, "thornwick");
    assert.equal(seen.pendingBattle?.kind, "pursuit");
    const back = recallPursuit(seen, force!.id);
    assert.equal(back.pursuits.length, 0);
    assert.equal(back.people.filter((person) => person.forceId === force!.id).length, 0);
  });
});

describe("search and concealment", () => {
  it("tells the judge the earlier searches and still feeds a miss", () => {
    assert.match(searchHistoryLine(0, false), /first search/);
    assert.match(searchHistoryLine(1, false), /1 time/);
    assert.match(searchHistoryLine(2, true), /2 times/);
    assert.match(searchHistoryLine(2, true), /trail/);
    let world = company();
    const band = world.company;
    if (!band) return;
    band.location = "thornwood";
    const before = band.bread;
    world = applyFind(world, "nothing");
    assert.equal(world.company!.bread, before + 1);
    assert.equal(world.campSeen, false);
    for (const person of world.people) if (person.groupId === "pack") person.alive = false;
    world.campSeen = false;
    world = applyFind(world, "bandits");
    assert.equal(world.campSeen, false);
    world = applyFind(world, "trail");
    assert.match(searchPrompt(world, "thornwood"), /trail/);
  });

  it("hides for a week, and sets the stances for a find", () => {
    let world = hide(company());
    assert.equal(world.company!.hiddenUntilWeek, world.week + 1);
    world.week += 2;
    assert.ok((world.company!.hiddenUntilWeek ?? 0) < world.week);
    assert.equal(refuge(company(), false).company!.hiddenUntilWeek, null);
    assert.equal(refuge(company(), true).company!.hiddenUntilWeek, 2);
    assert.equal(resolveFind(company(), false).foeStance, "Unready");
    assert.equal(resolveFind(company(), false).ambushReady, true);
    assert.equal(resolveFind(company(), true).foeStance, "Holding");
  });
});

describe("work, rest, inn, and quests", () => {
  it("pays for work from the employer's own stock", () => {
    const world = company();
    world.company!.units[1]!.headcount = 0;
    const fields = workFields(world);
    assert.equal(fields.ok, true);
    if (!fields.ok) return;
    assert.equal(storeOf(fields.world, "thornwick").bread, 580 - 30);
    assert.equal(fields.world.company!.bread, 280 + 30);
    const drifted = resolveWeek(fields.world, { raids: false, plots: false, upkeep: true });
    assert.equal(drifted.company!.units[0]?.condition, CONDITION);
    const thin = company();
    thin.company!.units[1]!.headcount = 0;
    const watch = merchantGuard(thin, "benet");
    assert.equal(watch.ok, true);
    if (!watch.ok) return;
    assert.equal(watch.world.people.find((person) => person.npcId === "benet")?.gold, 0);
    assert.equal(watch.world.company!.gold, 123);
    const village = guardDuty(thin, "village");
    assert.equal(village.ok, true);
    if (!village.ok) return;
    assert.equal(village.world.company!.gold, 125);
    const city = guardDuty(company(), "city");
    assert.equal(city.ok, true);
    if (!city.ok) return;
    assert.equal(city.world.company!.gold, 140);
  });

  it("rests, and a refused requisition moves nothing until it is declined", () => {
    let world = rest(company(), "own");
    assert.equal(world.ok, true);
    if (!world.ok) return;
    const again = rest(world.world, "own");
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.ok((again.world.hiddenScores.thornwick ?? 0) < 0);
    const store = storeOf(again.world, "thornwick").bread;
    const refused = rest(again.world, "requisition", false);
    assert.equal(refused.ok, true);
    if (!refused.ok) return;
    const declined = declineForce(refused.world);
    assert.equal(storeOf(declined, "thornwick").bread, store);
  });

  it("keeps three rumours and refuses a quest the giver cannot pay", () => {
    let world = addRumours(company(), ["A trail.", "The steward is afraid.", "Wolves.", "A fourth."]);
    assert.equal(world.rumours.length, 3);
    world.company!.location = "thornwood";
    assert.match(searchPrompt(world, "thornwood"), /trail/i);
    assert.equal(createQuest(world, "hale", 1000, "gold", "Clear the wood.").ok, false);
    assert.equal(createQuest(world, "hale", 50, "gold", "Clear the wood.").ok, true);
  });
});

describe("tutorial, seals, and the score", () => {
  it("can be skipped, and Fenn's loaf is a real transfer", () => {
    const start = company();
    const fenn = start.people.find((person) => person.npcId === "fenn")!.bread;
    const skipped = skipTutorial(start);
    assert.equal(skipped.tutorialDone, true);
    assert.equal(skipped.people.find((person) => person.npcId === "fenn")?.bread, fenn);
    let world = company();
    const before = world.people.find((person) => person.npcId === "fenn")!.bread;
    world = advanceTutorial(world);
    world = advanceTutorial(world);
    world = advanceTutorial(world);
    assert.equal(world.deals[0]?.amount, 30);
    world = advanceTutorial(world);
    assert.ok(world.people.find((person) => person.npcId === "fenn")!.bread < before);
    assert.ok(world.company!.bread > 280);
  });

  it("earns each seal from the log and keeps the score free of them", () => {
    const world = company();
    world.company!.gold = 100;
    world.company!.bread = 20;
    world.company!.goods = [{ id: "pelt", name: "A pelt", price: 5 }];
    world.company!.debts = [{ id: "d", npcId: "hale", amount: 30, currency: "gold", dueWeek: 6, direction: "company-owes", status: "open" }];
    assert.equal(netWorth(world), 85);
    const samples: [string, () => void][] = [
      ["first-muster", () => world.events.push({ week: 1, type: "recruit", significant: true })],
      ["blooded", () => world.events.push({ week: 1, type: "fight", significant: true })],
      ["loose-tongues", () => world.rumours.push({ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" })],
      ["found-them", () => (world.campSeen = true)],
      ["ghost", () => world.events.push({ week: 1, type: "hid-through-search", significant: true })],
      ["sanctuary", () => world.events.push({ week: 1, type: "refuge", significant: true })],
      ["brigands", () => world.events.push({ week: 1, type: "pillage", significant: true })],
      ["silver-tongue", () => world.events.push({ week: 1, type: "negotiated", significant: true })],
      ["from-the-shadows", () => world.events.push({ week: 1, type: "ambush-win", significant: true })],
      ["pardoned", () => world.events.push({ week: 1, type: "pardoned", significant: true })],
      ["loyal-blade", () => world.events.push({ week: 1, type: "crush-rebellion", significant: true })],
      ["kingbreaker", () => world.events.push({ week: 1, type: "kingbreaker", significant: true })],
      ["sack", () => world.events.push({ week: 1, type: "sack-crownmarket", significant: true })],
      ["thornbacks-bane", () => (world.thornback = { placed: true, alive: false, hidden: false, found: true })],
      ["wolf-warden", () => {
        world.wolvesAlive = false;
        world.events.push({ week: 3, type: "wolves", significant: true });
      }],
      ["honest-work", () => {
        world.events.push({ week: 1, type: "work-fields", significant: false });
        world.events.push({ week: 1, type: "work-merchant", significant: false });
        world.events.push({ week: 1, type: "work-village-guard", significant: false });
      }],
    ];
    assert.equal(sealName(world, "ghost"), "");
    for (const [id, mark] of samples) {
      mark();
      assert.ok(earnedSealIds(world).includes(id), id);
    }
    assert.equal(sealName(world, "ghost"), "Ghost");
    assert.equal(visibleSeals(world).some((seal) => seal.name === "Ghost"), true);
    world.company!.units[0]!.headcount = 10;
    world.company!.units[0]!.personIds = ["x"];
    assert.ok(earnedSealIds(world).includes("full-ranks"));
    while (world.company!.units.length < 10) {
      world.company!.units.push({ ...world.company!.units[0]!, id: `s${world.company!.units.length}`, headcount: 1, personIds: [] });
    }
    assert.ok(earnedSealIds(world).includes("ten-banners"));
    world.wiki.push({ key: "trackers", strengths: "paths", weaknesses: "raw", definedBy: "ai" });
    assert.ok(earnedSealIds(world).includes("odd-company"));
    for (const person of world.people) if (person.groupId === "pack") person.alive = false;
    assert.ok(earnedSealIds(world).includes("thornwood-cleared"));
    world.week = 12;
    world.events = world.events.filter((event) => event.type !== "pillage");
    assert.ok(earnedSealIds(world).includes("clean-hands"));
    world.company!.paidThisWeek = true;
    assert.ok(earnedSealIds(world).includes("never-short"));
    const rich = netWorth(world);
    world.company!.gold = 1000;
    world.company!.bread = 0;
    world.company!.goods = [];
    world.company!.debts = [];
    assert.ok(netWorth(world) >= 1000);
    assert.ok(earnedSealIds(world).includes("breadwinner"));
    world.company!.units.forEach((unit) => (unit.headcount = 0));
    world.company!.units[0]!.headcount = 5;
    assert.ok(earnedSealIds(world).includes("last-stand"));
    const closed = closeYear(world);
    assert.equal(closed.score, netWorth(closed));
    const before = netWorth(closed);
    closed.seals.push("ghost");
    assert.equal(netWorth(closed), before);
    void rich;
    void CONDITION;
  });
});

describe("saves", () => {
  it("does not load a Riverlands company", () => {
    assert.equal(reviveSave({ version: 1, companyName: "The Grey Company" }), null);
    const game = freshGame();
    assert.equal(game.company?.location, "thornwick");
    assert.equal(game.company?.founded, false);
    assert.equal(reviveSave({ version: 2, world: game })?.week, 1);
  });
});
