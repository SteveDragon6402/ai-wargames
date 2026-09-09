import { SEATS_BY_STATE, STATES } from "../data/valden";
import type { FactionId, SecretTestState } from "../types";
import { rivalFaction } from "../types";

export function leanColor(lean: number): string {
  const t = Math.min(1, Math.abs(lean));
  const gray = { r: 138, g: 140, b: 142 };
  const hot = lean >= 0 ? { r: 196, g: 40, b: 40 } : { r: 40, g: 84, b: 176 };
  const r = Math.round(gray.r + (hot.r - gray.r) * t);
  const g = Math.round(gray.g + (hot.g - gray.g) * t);
  const b = Math.round(gray.b + (hot.b - gray.b) * t);
  return `rgb(${r},${g},${b})`;
}

export function formatKr(n: number): string {
  return `kr ${Math.round(n).toLocaleString("en")}`;
}

export function seatSide(lean: number): FactionId | "toss" {
  if (lean > 0.08) return "red";
  if (lean < -0.08) return "blue";
  return "toss";
}

export function usThem(lean: number, faction: FactionId): "us" | "them" | "toss" {
  const side = seatSide(lean);
  if (side === "toss") return "toss";
  return side === faction ? "us" : "them";
}

/** Exec-desk map: us/them, not a dump of lean numbers. */
export function humanMapDigest(state: SecretTestState, faction: FactionId): string {
  const byId = new Map(state.seats.map((s) => [s.id, s]));
  const other = rivalFaction(faction);
  const lines = [
    `You are ${faction.toUpperCase()}. The other campaign is ${other.toUpperCase()}. Red on the map = Red. Blue = Blue. Grey = toss-up.`,
  ];
  for (const st of STATES) {
    const defs = SEATS_BY_STATE[st.id];
    const need = Math.floor(defs.length / 2) + 1;
    let us = 0;
    let them = 0;
    const seats = defs.map((d) => {
      const lean = byId.get(d.id)?.lean ?? 0;
      const tag = usThem(lean, faction);
      if (tag === "us") us += 1;
      if (tag === "them") them += 1;
      return `${d.name} (${tag})`;
    });
    let headline = "SPLIT — nobody has locked it";
    if (us >= need) headline = "WE are carrying this";
    else if (them >= need) headline = "THEY are carrying this";
    lines.push(
      `${st.name} (${defs.length} seats, need ${need}): ${headline}. ${seats.join("; ")}.`
    );
  }
  return lines.join("\n");
}
