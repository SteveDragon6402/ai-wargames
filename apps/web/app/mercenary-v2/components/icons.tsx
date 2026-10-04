/** Original single-colour ink marks. One glyph per fact. */
const PATHS: Record<string, string> = {
  gold: "M8 14h16v2H8zm2-6h12l2 4H8z",
  bread: "M6 16c0-6 4-8 10-8s10 2 10 8v2H6z",
  soldier: "M16 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6 16v-6l6-2 6 2v6",
  wounded: "M14 8h4v6h6v4h-6v6h-4v-6H8v-4h6z",
  morale: "M8 18c4-8 12-8 16 0",
  condition: "M6 20l6-12 4 8 3-4 7 8z",
  aggressive: "M8 22 L16 6 L24 22",
  holding: "M8 10h16v12H8z",
  skirmish: "M6 20h8l4-10 4 6h4",
  unready: "M8 16h16M16 8v16",
  cloak: "M10 8c4 2 8 2 12 0l2 16H8z",
  column: "M10 22V8h4v14zm8 0V12h4v10z",
  smoke: "M12 22c0-6 8-6 8-12 0 6 8 6 8 12",
  exclamation: "M15 6h2v12h-2zm0 14h2v2h-2z",
  rumour: "M6 10h14l6 4v2l-6-2H6z",
  quest: "M8 6h16v16H8z M12 10h8",
  seal: "M16 6a8 8 0 1 1 0 16 8 8 0 0 1 0-16z",
  hourglass: "M10 6h12l-6 8 6 8H10l6-8z",
  pelt: "M8 20c2-8 6-12 8-12s6 4 8 12z",
  sword: "M16 4v18M12 8h8M14 24h4",
  tower: "M10 26V10h12v16M14 6h4v4",
  stag: "M16 18c-6 0-8 6-8 6M16 18c6 0 8 6 8 6M12 10l4 8 4-8",
  sun: "M16 10a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM16 4v3M16 25v3M4 16h3M25 16h3",
  wolf: "M8 14l4 8 4-6 4 6 4-8-6-6z",
  ship: "M6 18h20l-3 6H9zM16 8v10",
  tree: "M16 26V14M10 16l6-8 6 8z",
  star: "M16 4l3 8h8l-6 5 2 8-7-5-7 5 2-8-6-5h8z",
  spearmen: "M16 4v24M12 10h8",
  swordsmen: "M8 8l16 16M20 8L8 20",
  archers: "M8 24c8-16 8-16 16 0M16 12v12",
  crossbowmen: "M6 14h20M16 8v16",
  cavalry: "M6 20c4-8 16-8 20 0M10 14h8",
  trackers: "M8 22c4-2 4-8 8-8s4 6 8 8",
};

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const d = PATHS[name] ?? PATHS.seal;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function Face({ level }: { level?: string }) {
  return <i className={`mc2-face ${level ?? "neutral"}`} title={level ?? "neutral"} />;
}
