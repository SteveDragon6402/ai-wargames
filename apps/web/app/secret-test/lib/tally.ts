import { SEATS_BY_STATE, STATES } from "../data/valden";
import type { FactionId, SeatRuntime, StateId } from "../types";

const LEAN_CUTOFF = 0.05;

export function seatCarrier(lean: number): FactionId | "toss" {
  if (lean > LEAN_CUTOFF) return "red";
  if (lean < -LEAN_CUTOFF) return "blue";
  return "toss";
}

export function tallyStates(seats: SeatRuntime[]): Record<StateId, FactionId | "split"> {
  const byId = new Map(seats.map((s) => [s.id, s]));
  const out = {} as Record<StateId, FactionId | "split">;
  for (const state of STATES) {
    const defs = SEATS_BY_STATE[state.id];
    let red = 0;
    let blue = 0;
    for (const def of defs) {
      const runtime = byId.get(def.id);
      const who = seatCarrier(runtime?.lean ?? 0);
      if (who === "red") red += 1;
      if (who === "blue") blue += 1;
    }
    const need = Math.floor(defs.length / 2) + 1;
    if (red >= need) out[state.id] = "red";
    else if (blue >= need) out[state.id] = "blue";
    else out[state.id] = "split";
  }
  return out;
}

export function statesWon(tally: Record<StateId, FactionId | "split">, faction: FactionId): number {
  return STATES.filter((s) => tally[s.id] === faction).length;
}
