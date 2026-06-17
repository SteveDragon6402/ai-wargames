import type { Command, GameState } from "@wargame/shared";
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
  state: jsonb("state").$type<GameState>().notNull(),
  winnerFactionId: text("winner_faction_id"),
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
    command: jsonb("command").$type<Command>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("orders_room_turn_unit_idx").on(t.roomId, t.turn, t.unitId),
  ]
);
