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
