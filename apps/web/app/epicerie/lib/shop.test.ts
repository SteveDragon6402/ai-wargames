import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ITEMS } from "../data/items";
import { DAILY_PURSE, LISTS, listForDay } from "../data/lists";
import {
  addLine,
  addNote,
  formatEuros,
  itemsNamedIn,
  learnWords,
  linesTotal,
  listComplete,
  listProgress,
  makeChange,
  mergeLines,
  newSession,
  parseSave,
  pay,
  removeCoins,
  removeLine,
  sumCoins,
  MAX_NOTES,
} from "./shop";

describe("épicerie data", () => {
  it("has eighteen unique items, three to a shelf, with whole-cent prices", () => {
    assert.equal(ITEMS.length, 18);
    assert.equal(new Set(ITEMS.map((item) => item.id)).size, 18);
    const slots = new Set(ITEMS.map((item) => `${item.unit}-${item.shelf}-${item.slot}`));
    assert.equal(slots.size, 18);
    assert.ok(ITEMS.every((item) => item.slot < 3));
    for (const item of ITEMS) assert.ok(Number.isInteger(item.price) && item.price > 0 && item.price % 10 === 0, item.id);
  });

  it("only lists items the shop sells, and every day's list is affordable from the purse", () => {
    const purse = sumCoins(DAILY_PURSE);
    assert.equal(purse, 2270);
    for (const list of LISTS) {
      const lines = list.entries.map((entry) => ({ itemId: entry.itemId, qty: entry.qty }));
      assert.equal(lines.length, mergeLines([], lines).length);
      const total = linesTotal(lines);
      assert.ok(total > 0 && total <= purse - 200, `${list.title} costs ${total}`);
    }
  });

  it("cycles the lists by day", () => {
    assert.equal(listForDay(0).title, "Monday");
    assert.equal(listForDay(3).title, "Monday");
    assert.equal(listForDay(5).title, "Wednesday");
  });
});

describe("money", () => {
  it("formats euros the French way", () => {
    assert.equal(formatEuros(1540), "15,40 €");
    assert.equal(formatEuros(5), "0,05 €");
    assert.equal(formatEuros(0), "0,00 €");
  });

  it("makes change in real denominations", () => {
    assert.deepEqual(makeChange(0), []);
    assert.deepEqual(makeChange(385), [200, 100, 50, 20, 10, 5]);
    assert.deepEqual(makeChange(1730), [1000, 500, 200, 20, 10]);
    assert.equal(sumCoins(makeChange(4321)), 4321);
  });

  it("only takes coins the purse holds", () => {
    assert.deepEqual(removeCoins([200, 100, 100], [100]), [200, 100]);
    assert.equal(removeCoins([200, 100], [100, 100]), null);
    assert.equal(removeCoins([200], [500]), null);
  });

  it("pays exact, overpays with change, refuses short or with no sale open", () => {
    const purse = [...DAILY_PURSE];
    const exact = pay(purse, [200, 50, 10], 260);
    assert.ok(exact.ok);
    if (exact.ok) {
      assert.deepEqual(exact.change, []);
      assert.equal(sumCoins(exact.purse), 2270 - 260);
    }
    const over = pay(purse, [1000], 260);
    assert.ok(over.ok);
    if (over.ok) {
      assert.equal(sumCoins(over.change), 740);
      assert.equal(sumCoins(over.purse), 2270 - 260);
    }
    const short = pay(purse, [200], 260);
    assert.deepEqual(short, { ok: false, reason: "short", paid: 200 });
    assert.deepEqual(pay(purse, [200], null), { ok: false, reason: "no-sale", paid: 200 });
    assert.deepEqual(pay(purse, [2000], 260), { ok: false, reason: "not-in-purse", paid: 2000 });
  });
});

describe("counter and basket", () => {
  it("adds, merges and removes lines", () => {
    let lines = addLine([], "lemon", 1);
    lines = addLine(lines, "lemon", 1);
    lines = addLine(lines, "baguette", 1);
    assert.deepEqual(lines, [
      { itemId: "lemon", qty: 2 },
      { itemId: "baguette", qty: 1 },
    ]);
    assert.equal(linesTotal(lines), 230);
    assert.deepEqual(removeLine(lines, "lemon", 1), [
      { itemId: "lemon", qty: 1 },
      { itemId: "baguette", qty: 1 },
    ]);
    assert.deepEqual(removeLine(lines, "lemon"), [{ itemId: "baguette", qty: 1 }]);
  });

  it("ignores unknown items and bad quantities", () => {
    assert.deepEqual(addLine([], "unicorn", 1), []);
    assert.deepEqual(addLine([], "lemon", 0), []);
    assert.deepEqual(addLine([], "lemon", 1.5), []);
  });

  it("tracks list progress from the basket", () => {
    const list = listForDay(0);
    let basket = addLine([], "lemon", 1);
    const progress = listProgress(list, basket);
    assert.equal(progress.find((entry) => entry.itemId === "lemon")?.have, 1);
    assert.equal(progress.find((entry) => entry.itemId === "lemon")?.done, false);
    assert.equal(listComplete(list, basket), false);
    for (const entry of list.entries) basket = addLine(basket, entry.itemId, entry.qty);
    assert.equal(listComplete(list, basket), true);
  });
});

describe("hearing words", () => {
  it("recognises French item names with accents, plurals and elision", () => {
    assert.deepEqual(itemsNamedIn("Ah, les œufs ! Une boîte de six."), ["eggs"]);
    assert.deepEqual(itemsNamedIn("Deux citrons, voilà."), ["lemon"]);
    assert.deepEqual(itemsNamedIn("Une tête d'ail et du chocolat ?"), ["chocolate", "garlic"]);
    assert.deepEqual(itemsNamedIn("L'enveloppe est là-haut."), ["envelope"]);
    assert.deepEqual(itemsNamedIn("Des champignons, une barquette"), ["mushrooms"]);
  });

  it("does not hear items inside other words", () => {
    assert.deepEqual(itemsNamedIn("Je travaille ici depuis vingt ans, s'il vous plaît."), []);
    assert.deepEqual(itemsNamedIn("Bonjour monsieur !"), []);
  });

  it("adds each word to the carnet once", () => {
    let carnet = learnWords([], "Une baguette ?", 0);
    carnet = learnWords(carnet, "Oui, la baguette, et un citron.", 1);
    assert.deepEqual(carnet, [
      { itemId: "baguette", day: 0 },
      { itemId: "lemon", day: 1 },
    ]);
  });
});

describe("saves", () => {
  it("falls back to a fresh save on garbage", () => {
    assert.equal(parseSave(null).day, 0);
    assert.equal(parseSave("{nope").day, 0);
    assert.equal(parseSave(JSON.stringify({ version: 2 })).visits, 0);
  });

  it("round-trips a session and drops anything malformed", () => {
    const session = newSession(1);
    session.counter = [{ itemId: "honey", qty: 1 }];
    session.till = 650;
    session.transcript = [
      { role: "you", text: "Bonjour" },
      { role: "gerard", text: "Bonjour !", expression: "smile" },
    ];
    const raw = JSON.stringify({ version: 1, day: 1, visits: 1, notes: ["Likes honey", 7], carnet: [{ itemId: "honey", day: 0 }, { itemId: "x", day: 0 }], session, voice: false });
    const save = parseSave(raw);
    assert.deepEqual(save.notes, ["Likes honey"]);
    assert.deepEqual(save.carnet, [{ itemId: "honey", day: 0 }]);
    assert.equal(save.session?.till, 650);
    assert.equal(save.session?.transcript.length, 2);
    assert.equal(save.voice, false);

    const broken = parseSave(JSON.stringify({ version: 1, session: { ...session, purse: [3] } }));
    assert.equal(broken.session, null);
    const noCounter = parseSave(JSON.stringify({ version: 1, session: { ...session, counter: [] } }));
    assert.equal(noCounter.session?.till, null);
  });

  it("keeps the last notes only", () => {
    let notes: string[] = [];
    for (let index = 0; index < MAX_NOTES + 3; index += 1) notes = addNote(notes, `note ${index}`);
    assert.equal(notes.length, MAX_NOTES);
    assert.equal(notes[0], "note 3");
    assert.deepEqual(addNote(["a"], "   "), ["a"]);
  });
});
