import { join } from "node:path";

export function getScenariosDir(): string {
  if (process.env.SCENARIOS_DIR) return process.env.SCENARIOS_DIR;
  return join(process.cwd(), "../../scenarios");
}

export function getTurnDurationSeconds(): number {
  const n = Number(process.env.DEFAULT_TURN_DURATION_SECONDS ?? "90");
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}
