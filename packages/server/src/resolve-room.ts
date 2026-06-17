import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { loadScenario, resolveTurn } from "@wargame/engine";
import { games, getDb, orders, players, rooms } from "@wargame/db";
import type { Command, FactionId, GameState } from "@wargame/shared";

function commandFaction(state: GameState, command: Command): FactionId | null {
  if (command.type === "abandon_capital") return "rohan";
  const unit = state.units[command.unitId];
  return unit?.factionId ?? null;
}

function buildFactionOrders(
  state: GameState,
  roomPlayers: { id: string; factionId: string }[],
  currentOrders: { playerId: string; command: Command }[],
  soloDualFaction: boolean
): { factionId: FactionId; commands: Command[] }[] {
  if (!soloDualFaction) {
    return roomPlayers.map((p) => ({
      factionId: p.factionId as FactionId,
      commands: currentOrders
        .filter((o) => o.playerId === p.id)
        .map((o) => o.command),
    }));
  }

  const factions: FactionId[] = ["rohan", "isengard"];
  return factions.map((factionId) => ({
    factionId,
    commands: currentOrders
      .filter((o) => commandFaction(state, o.command) === factionId)
      .map((o) => o.command),
  }));
}
import { getScenariosDir, getTurnDurationSeconds } from "./env.js";
import { createAIAdjudicator, type ScenarioWiki } from "./ai-adjudicator.js";

function loadWiki(scenariosDir: string, scenarioId: string): ScenarioWiki | null {
  try {
    const wikiPath = join(scenariosDir, scenarioId, "wiki.json");
    const raw = readFileSync(wikiPath, "utf-8");
    return JSON.parse(raw) as ScenarioWiki;
  } catch {
    return null;
  }
}

export async function resolveRoomTurn(roomId: string) {
  const db = getDb();

  const [claimed] = await db
    .update(games)
    .set({ phase: "resolving" })
    .where(and(eq(games.roomId, roomId), eq(games.phase, "planning")))
    .returning();

  if (!claimed) return null;

  try {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (!room) return null;

    const roomPlayers = await db
      .select()
      .from(players)
      .where(eq(players.roomId, roomId));

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.roomId, roomId));

    const currentOrders = orderRows.filter((o) => o.turn === claimed.turn);

    const factionOrders = buildFactionOrders(
      claimed.state,
      roomPlayers,
      currentOrders.map((o) => ({
        playerId: o.playerId,
        command: o.command as Command,
      })),
      room.soloDualFaction ?? false
    );

    const scenariosDir = getScenariosDir();
    const { scenario } = loadScenario(scenariosDir, room.scenarioId);
    const wiki = loadWiki(scenariosDir, room.scenarioId);
    const adjudicator = wiki ? createAIAdjudicator(wiki) : undefined;

    const result = await resolveTurn(claimed.state, factionOrders, {
      combat: scenario.combat,
      rohanFallbackCapital: scenario.fallbackCapital?.rohan,
      adjudicator,
    });

    const winner = result.state.meta.winnerFactionId;
    const isSolo = room?.soloDualFaction ?? false;
    // Solo games have no timer — turns advance only on explicit submit
    const turnEndsAt = winner || isSolo
      ? null
      : new Date(Date.now() + getTurnDurationSeconds() * 1000);

    await db
      .update(games)
      .set({
        state: result.state,
        turn: result.state.turn,
        phase: result.state.phase,
        turnEndsAt,
        winnerFactionId: winner,
        readyPlayerIds: [],
        turnJobId: null,
      })
      .where(eq(games.roomId, roomId));

    if (winner) {
      await db
        .update(rooms)
        .set({ status: "finished" })
        .where(eq(rooms.id, roomId));
    }

    await db.delete(orders).where(eq(orders.roomId, roomId));

    return { result, turnEndsAt, winner, roomPlayers };
  } catch (err) {
    await db
      .update(games)
      .set({ phase: "planning" })
      .where(and(eq(games.roomId, roomId), eq(games.phase, "resolving")));
    throw err;
  }
}

export type AdvanceTurnOptions = {
  cancelScheduledJob?: (jobId: string) => Promise<void>;
};

/**
 * Resolve a stuck planning turn when the timer expired or every player has submitted.
 * Safe to call from polling; uses a DB claim so only one resolver wins.
 */
export async function maybeAdvanceTurn(
  roomId: string,
  options?: AdvanceTurnOptions
) {
  const db = getDb();
  const [game] = await db.select().from(games).where(eq(games.roomId, roomId)).limit(1);
  if (!game || game.phase !== "planning") return null;

  const roomPlayers = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.roomId, roomId));

  const ready = new Set(game.readyPlayerIds ?? []);
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const solo = room?.soloDualFaction ?? false;
  const minPlayers = solo ? 1 : 2;
  const allReady =
    roomPlayers.length >= minPlayers &&
    roomPlayers.every((p) => ready.has(p.id));
  const expired =
    game.turnEndsAt !== null && game.turnEndsAt.getTime() <= Date.now();

  if (!allReady && !expired) return null;

  if (game.turnJobId && options?.cancelScheduledJob) {
    await options.cancelScheduledJob(game.turnJobId);
  }

  return resolveRoomTurn(roomId);
}

/** @deprecated Use maybeAdvanceTurn */
export async function maybeResolveExpiredTurn(roomId: string) {
  return maybeAdvanceTurn(roomId);
}
