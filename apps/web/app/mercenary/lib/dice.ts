import { spawnSync } from "node:child_process";

/** A fair d100, rolled by Python. Faces are 1 through 100. */
export function rollD100(): number {
  const rolled = spawnSync("python3", ["-c", "import random\nprint(random.randint(1, 100))"], { encoding: "utf8" });
  if (rolled.status !== 0) throw new Error(rolled.stderr?.trim() || "The dice could not be rolled.");
  const value = Number(String(rolled.stdout ?? "").trim());
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error("The dice did not land.");
  return value;
}
