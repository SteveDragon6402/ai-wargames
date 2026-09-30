import { rollD100 } from "../../mercenary/lib/dice";
import type { Adjudication } from "./chronicle";

const MAX_CHANCE = 100;

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function chanceOf(value: unknown): number | null {
  const amount = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const whole = Math.round(amount);
  if (whole < 0 || whole > MAX_CHANCE) return null;
  return whole;
}

export function parseAdjudication(input: unknown): { question: string; chance: number } | null {
  const body = record(input);
  const question = text(body?.question);
  const chance = chanceOf(body?.chance);
  if (!question || chance === null) return null;
  return { question, chance };
}

export function settleAdjudication(question: string, chance: number, roll: number): Adjudication {
  return { question, chance, roll, happened: roll <= chance };
}

export function tellAdjudication(roll: Adjudication): string {
  return `Rolled ${roll.roll} against ${roll.chance} in a hundred. ${roll.happened ? "Yes. It happens." : "No. It does not."}`;
}

export function rollAdjudication(input: unknown): Adjudication | { error: string } {
  const asked = parseAdjudication(input);
  if (!asked) return { error: "Ask with a question and a chance from 0 to 100." };
  try {
    return settleAdjudication(asked.question, asked.chance, rollD100());
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The roll did not land." };
  }
}
