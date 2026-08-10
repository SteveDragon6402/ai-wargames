import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Opaque JSON blobs — GOT state lives in got_games; legacy LoTR columns keep loose typing. */
type JsonObject = Record<string, unknown>;
type JsonValue = unknown;

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("lobby"),
  scenarioId: text("scenario_id").notNull().default("rohan-vs-isengard"),
  hostPlayerId: uuid("host_player_id"),
  /** One human controls both factions (orders validated per unit faction). */
  soloDualFaction: boolean("solo_dual_faction").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  factionId: text("faction_id").notNull(),
  displayName: text("display_name").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export const games = pgTable("games", {
  roomId: uuid("room_id")
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),
  turn: integer("turn").notNull().default(1),
  phase: text("phase").notNull().default("planning"),
  turnEndsAt: timestamp("turn_ends_at", { withTimezone: true }),
  turnJobId: text("turn_job_id"),
  readyPlayerIds: jsonb("ready_player_ids").$type<string[]>().default([]).notNull(),
  state: jsonb("state").$type<JsonObject>().notNull(),
  winnerFactionId: text("winner_faction_id"),
  lastTurnEvents: jsonb("last_turn_events").$type<JsonValue[]>().default([]).notNull(),
});

export const gameHistory = pgTable(
  "game_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    turn: integer("turn").notNull(),
    events: jsonb("events").$type<JsonValue[]>().notNull(),
    stateAfter: jsonb("state_after").$type<JsonObject>().notNull(),
  },
  (t) => [uniqueIndex("game_history_room_turn_idx").on(t.roomId, t.turn)]
);

/** GOT Houses — persisted game state for room-based play. */
export const gotGames = pgTable("got_games", {
  roomId: uuid("room_id")
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),
  /** Full GOT GameState JSON blob */
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    turn: integer("turn").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    unitId: text("unit_id"),
    command: jsonb("command").$type<JsonObject>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("orders_room_turn_unit_idx").on(t.roomId, t.turn, t.unitId),
  ]
);
