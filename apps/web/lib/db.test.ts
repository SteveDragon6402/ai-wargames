import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  clearDbCacheForTesting,
  getGameSave,
  saveGameState,
  recordHistoryEvent,
  resetGameSave,
  readDatabase,
} from "./db";

const originalDataDir = process.env.DATA_DIR;
let currentTmpDir: string | null = null;

beforeEach(async () => {
  currentTmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "db-test-"));
  process.env.DATA_DIR = currentTmpDir;
  clearDbCacheForTesting();
});

afterEach(async () => {
  if (currentTmpDir) {
    await fs.rm(currentTmpDir, { recursive: true, force: true }).catch(() => {});
    currentTmpDir = null;
  }
  process.env.DATA_DIR = originalDataDir;
  clearDbCacheForTesting();
});

test("returns null when no save exists", async () => {
  const { save } = await getGameSave("sejour");
  assert.equal(save, null);
});

test("saves and reloads state across process/cache restarts", async () => {
  const mockSave = { version: 1, day: 3, journal: "Bonjour le monde" };
  await saveGameState("sejour", mockSave, "day_completed", { day: 3 });

  // Clear cache to simulate server restart reading from disk
  clearDbCacheForTesting();

  const loaded = await getGameSave("sejour");
  assert.deepEqual(loaded.save, mockSave);
  assert.ok(loaded.updatedAt);

  const db = await readDatabase();
  assert.equal(db.history.length, 1);
  assert.equal(db.history[0].event, "day_completed");
});

test("records history events independently", async () => {
  await recordHistoryEvent("epicerie", "bought_baguette", { cost: 120 });
  clearDbCacheForTesting();

  const db = await readDatabase();
  assert.ok(db.history.some((h) => h.event === "bought_baguette"));
});

test("resets a game without deleting the other game's data", async () => {
  await saveGameState("epicerie", { version: 1, visits: 5 });
  await saveGameState("sejour", { version: 1, day: 2 });

  await resetGameSave("sejour");
  clearDbCacheForTesting();

  const sejourAfter = await getGameSave("sejour");
  const epicerieAfter = await getGameSave("epicerie");

  assert.equal(sejourAfter.save, null);
  assert.ok(epicerieAfter.save !== null);
});
