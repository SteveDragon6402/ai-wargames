export function strengthLabel(strength: number): string {
  if (strength >= 0.85) return "at full strength";
  if (strength >= 0.65) return "bloodied";
  if (strength >= 0.40) return "weakened";
  if (strength >= 0.20) return "badly mauled";
  return "on the verge of collapse";
}

export function moraleLabel(morale: number): string {
  if (morale >= 80) return "high morale";
  if (morale >= 60) return "steady";
  if (morale >= 40) return "wavering";
  if (morale >= 20) return "shaken";
  return "on the verge of rout";
}

export function fatigueLabel(tiredness: number): string {
  if (tiredness <= 0.1) return "fresh";
  if (tiredness <= 0.3) return "lightly fatigued";
  if (tiredness <= 0.5) return "tired";
  if (tiredness <= 0.7) return "exhausted";
  return "spent";
}

export function dugInLabel(dugIn: number): string {
  if (dugIn <= 0.05) return "no cover";
  if (dugIn <= 0.2) return "light cover";
  if (dugIn <= 0.4) return "improved position";
  if (dugIn <= 0.7) return "well entrenched";
  return "heavily fortified";
}
