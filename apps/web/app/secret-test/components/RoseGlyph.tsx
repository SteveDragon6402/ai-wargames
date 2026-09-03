import type { FactionId } from "../types";

export function RoseGlyph({
  house,
  size = 28,
}: {
  house: FactionId;
  size?: number;
}) {
  const fill = house === "lancaster" ? "#7a1420" : "#e8e2d4";
  const stroke = house === "lancaster" ? "#c45c5c" : "#8a8580";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      style={{ display: "block" }}
    >
      <circle cx="32" cy="32" r="30" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.7" />
      <path
        d="M32 18c3 4 4 8 0 12-4-4-3-8 0-12zm0 12c4 3 8 4 12 0-4-4-8-3-12 0zm0 0c-4 3-8 4-12 0 4-4 8-3 12 0zm0 0c3 4 4 8 0 12-4-4-3-8 0-12z"
        fill={fill}
      />
      <circle cx="32" cy="32" r="5.5" fill={house === "lancaster" ? "#3a0a10" : "#5a564c"} />
      <circle cx="32" cy="32" r="2.2" fill={house === "lancaster" ? "#c8941a" : "#f4eee0"} />
    </svg>
  );
}
