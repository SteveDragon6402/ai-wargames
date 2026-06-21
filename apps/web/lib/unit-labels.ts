/**
 * Converts raw numeric unit stats into qualitative military-style labels.
 * Keeps implementation details out of the UI layer.
 */

/** Base troop count a unit at full strength represents. */
const FULL_STRENGTH_TROOPS = 3000;

/** ~N,NNN effectives */
export function troopCount(strength: number): string {
  const n = Math.round(strength * FULL_STRENGTH_TROOPS);
  return `~${n.toLocaleString()} effectives`;
}

/** "Full strength" → "Destroyed" */
export function strengthLabel(strength: number): string {
  if (strength >= 0.85) return "Full strength";
  if (strength >= 0.65) return "Bloodied";
  if (strength >= 0.40) return "Weakened";
  if (strength >= 0.20) return "Badly mauled";
  return "On the verge of collapse";
}

/** Strength bar color class */
export function strengthColor(strength: number): string {
  if (strength >= 0.7) return "bg-emerald-500";
  if (strength >= 0.4) return "bg-amber-500";
  return "bg-red-500";
}

/** "Steadfast" → "Broken" based on morale 0–100 */
export function moraleLabel(morale: number): string {
  if (morale >= 80) return "Steadfast";
  if (morale >= 60) return "Steady";
  if (morale >= 40) return "Wavering";
  if (morale >= 25) return "Shaken";
  return "Broken";
}

/** Morale bar color class */
export function moraleColor(morale: number): string {
  if (morale >= 60) return "bg-sky-500";
  if (morale >= 40) return "bg-amber-500";
  return "bg-red-500";
}

/** "Fresh" → "Exhausted" from tiredness 0–1 */
export function fatigueLabel(tiredness: number): string {
  if (tiredness <= 0.15) return "Fresh";
  if (tiredness <= 0.35) return "Weary";
  if (tiredness <= 0.6) return "Tired";
  if (tiredness <= 0.8) return "Exhausted";
  return "Spent";
}

/** — / Light works / Dug in / Entrenched based on dugIn 0–1 */
export function fortificationLabel(dugIn: number): string {
  if (dugIn <= 0.05) return "None";
  if (dugIn <= 0.3) return "Light works";
  if (dugIn <= 0.65) return "Dug in";
  return "Entrenched";
}

/** Render up to 4 filled/hollow stars from a raw stat value scaled 1–10. */
export function combatStars(value: number, max = 10): string {
  const filled = Math.round((value / max) * 4);
  return "★".repeat(filled) + "☆".repeat(4 - filled);
}

/** "Attack quality" qualifier for a sidebar tooltip. */
export function attackLabel(value: number): string {
  if (value >= 9) return "Ferocious";
  if (value >= 7) return "Strong";
  if (value >= 5) return "Average";
  if (value >= 3) return "Weak";
  return "Poor";
}

/** "Defence quality" qualifier. */
export function defenseLabel(value: number): string {
  if (value >= 9) return "Stalwart";
  if (value >= 7) return "Firm";
  if (value >= 5) return "Average";
  if (value >= 3) return "Exposed";
  return "Brittle";
}

/** "Rohan" / "Isengard" display name from faction ID. */
export function factionDisplayName(factionId: string): string {
  const names: Record<string, string> = {
    rohan: "Rohan",
    isengard: "Isengard",
    lannister: "Lannister",
    stark: "Stark",
  };
  return names[factionId] ?? factionId.charAt(0).toUpperCase() + factionId.slice(1);
}
