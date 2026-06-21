import { z } from "zod";

export const speedSchema = z.enum(["slow", "normal", "forced"]);
export const stanceSchema = z.enum(["aggressive", "defensive", "balanced"]);
export const moveIntentionSchema = z.enum([
  "assault",
  "attack",
  "reinforce",
  "balanced",
]);
export const attackIntentionSchema = z.enum([
  "assault",
  "attack",
  "defend",
  "breakthrough",
]);
export const digInIntentionSchema = z.enum(["deny", "hold"]);
export const factionIdSchema = z.enum(["rohan", "isengard", "lannister", "stark"]);

export const moveCommandSchema = z.object({
  type: z.literal("move"),
  unitId: z.string(),
  targetNodeId: z.string(),
  speed: speedSchema,
  stance: stanceSchema,
  intention: moveIntentionSchema,
  edgeId: z.string().optional(),
});

export const digInCommandSchema = z.object({
  type: z.literal("dig_in"),
  unitId: z.string(),
  intention: digInIntentionSchema,
});

export const attackCommandSchema = z.object({
  type: z.literal("attack"),
  unitId: z.string(),
  targetUnitId: z.string().optional(),
  stance: stanceSchema,
  intention: attackIntentionSchema,
  breakthroughTargetNodeId: z.string().optional(),
});

export const coverCommandSchema = z.object({
  type: z.literal("cover"),
  unitId: z.string(),
  coverUnitId: z.string(),
});

export const retreatCommandSchema = z.object({
  type: z.literal("retreat"),
  unitId: z.string(),
  targetNodeId: z.string(),
  speed: speedSchema,
});

export const disengageCommandSchema = z.object({
  type: z.literal("disengage"),
  unitId: z.string(),
});

export const commandSchema = z.discriminatedUnion("type", [
  moveCommandSchema,
  digInCommandSchema,
  attackCommandSchema,
  coverCommandSchema,
  retreatCommandSchema,
  disengageCommandSchema,
]);

export const createRoomSchema = z.object({
  displayName: z.string().min(1).max(32),
});

export const joinRoomSchema = z.object({
  code: z.string().length(6),
  displayName: z.string().min(1).max(32),
});

export const upsertOrderSchema = z.object({
  command: commandSchema,
});
