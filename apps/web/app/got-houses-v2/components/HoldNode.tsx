"use client";

import { Handle, Position } from "@xyflow/react";
import type { Army, Faction } from "../types";
import { REGION_COLORS, REGION_BORDER_COLORS } from "../data/holds";
import { holdSpineColor, holdSpineOwner } from "../lib/hold-runtime";

/** Where a garrison stands relative to the seat's own default strength. */
export type GarrisonBand =
  | "empty"
  | "skeleton"
  | "at_strength"
  | "reinforced";

export type MapView = "seats" | "hosts" | "country";

export interface HoldNodeData {
  id: string;
  label: string;
  region: string;
  armies: Army[];
  isSelected: boolean;
  isMoveTarget: boolean;
  isInMoveMode: boolean;
  mapView?: MapView;
  forageStep?: 0 | 1 | 2 | 3 | 4;
  /** Who holds the seat right now; null when unheld. */
  controller?: Faction | "hostile" | null;
  /** Regional home — used for the spine when controller is missing. */
  homeFaction?: Faction | "hostile" | null;
  /** Precomputed ownership strip — kept as a primitive so React Flow refreshes it. */
  spineColor?: string;
  /** Northern houses that have gone over to the Westerlands. */
  turnedHouses?: string[];
  /** Distinct from fortify — men inside the walls */
  hasGarrison?: boolean;
  /** Garrison headcount, for the tooltip and band. */
  garrisonMen?: number;
  garrisonBand?: GarrisonBand;
  /** Under investment */
  underSiege?: boolean;
  besiegerFaction?: Faction | null;
  siegeTurns?: number;
  /** Besieging force is too thin to hold the ring. */
  siegeUnderStrength?: boolean;
  /** Terms on the table / already answered at this seat. */
  termsState?: "offered" | "accepted" | "rejected" | null;
  /** Captured this turn and still owing a garrison. */
  awaitingGarrison?: boolean;
  /** Both factions have hosts here — a battle will be fought. */
  contested?: boolean;
  onArmyClick?: (armyId: string, shift: boolean) => void;
  [key: string]: unknown;
}

const FACTION_COLORS: Record<Faction, string> = {
  north: "#3a6ea8",
  westerlands: "#b03030",
};

const FACTION_NAMES: Record<Faction, string> = {
  north: "the North",
  westerlands: "the Westerlands",
};

const MONO = "var(--font-mono), monospace";

function strengthOf(army: Army): number {
  return (army.units ?? []).reduce((s, u) => s + u.count, 0);
}

function formatMen(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/**
 * One badge per side at a seat. Five anonymous pills at Moat Cailin asked the
 * player to count dots; this says “the North has 9k here” and clicking it
 * takes the largest host.
 */
function FactionStack({
  faction,
  armies,
  onClick,
}: {
  faction: Faction;
  armies: Army[];
  onClick?: (armyId: string, shift: boolean) => void;
}) {
  const men = armies.reduce((sum, a) => sum + strengthOf(a), 0);
  const largest = [...armies].sort((a, b) => strengthOf(b) - strengthOf(a))[0];
  const resting = armies.every((a) => (a.activity?.turnsResting ?? 0) > 0);
  const hosts =
    armies.length === 1
      ? armies[0].name
      : `${armies.length} hosts of ${FACTION_NAMES[faction]}`;
  return (
    <span
      role={onClick && largest ? "button" : undefined}
      className={onClick ? "nopan nodrag" : undefined}
      title={`${hosts} — ${men.toLocaleString()} men. Click to command.`}
      onMouseDown={(e) => {
        if (!onClick) return;
        e.stopPropagation();
      }}
      onClick={(e) => {
        if (!onClick || !largest) return;
        e.stopPropagation();
        onClick(largest.id, e.shiftKey);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        height: 14,
        padding: "0 5px",
        borderRadius: 2,
        background: FACTION_COLORS[faction],
        border: "1px solid rgba(255,255,255,0.18)",
        flexShrink: 0,
        opacity: resting ? 0.6 : 1,
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: 700,
        color: "rgba(255,255,255,0.95)",
        lineHeight: 1,
        cursor: onClick ? "pointer" : "inherit",
        letterSpacing: "0.02em",
      }}
    >
      {formatMen(men)}
      {armies.length > 1 ? (
        <span style={{ fontWeight: 500, opacity: 0.8 }}>×{armies.length}</span>
      ) : null}
    </span>
  );
}

const BAND_GLYPH: Record<GarrisonBand, string> = {
  empty: "▢",
  skeleton: "▤",
  at_strength: "▦",
  reinforced: "▩",
};

const BAND_COLOR: Record<GarrisonBand, string> = {
  empty: "#4a4a4a",
  skeleton: "#8a7a3a",
  at_strength: "#8a8a6a",
  reinforced: "#b0b070",
};

const BAND_LABEL: Record<GarrisonBand, string> = {
  empty: "walls unmanned",
  skeleton: "below its usual strength",
  at_strength: "at strength",
  reinforced: "reinforced beyond its usual strength",
};

const FORAGE_FILL = ["#16301c", "#1e2c16", "#2a2816", "#2c2014", "#241818"] as const;
const FORAGE_WORD = ["Full", "Gleaned", "Picked", "Thin", "Bare"] as const;

const SEAT_FILL: Record<string, string> = {
  north: "#102438",
  westerlands: "#2c1010",
  hostile: "#2a1c10",
  none: "#161616",
};

function HoldNode({ data }: { data: HoldNodeData }) {
  const {
    label,
    region,
    armies,
    isSelected,
    isMoveTarget,
    isInMoveMode,
    controller,
    homeFaction,
    spineColor,
    garrisonMen,
    garrisonBand,
    underSiege,
    besiegerFaction,
    siegeTurns,
    siegeUnderStrength,
    termsState,
    awaitingGarrison,
    contested,
    mapView = "hosts",
    forageStep = 0,
    onArmyClick,
  } = data;

  const northArmies = armies.filter((a) => a.faction === "north");
  const westArmies = armies.filter((a) => a.faction === "westerlands");
  const hasArmies = armies.length > 0;
  const showHosts = mapView === "hosts";
  const showSeats = mapView === "seats";
  const showCountry = mapView === "country";

  const seatWho =
    controller === "north" || controller === "westerlands" || controller === "hostile"
      ? controller
      : "none";
  const bg = showCountry
    ? FORAGE_FILL[forageStep]
    : showSeats
      ? SEAT_FILL[seatWho] ?? SEAT_FILL.none
      : REGION_COLORS[region] ?? "#111";
  const borderBase = REGION_BORDER_COLORS[region] ?? "#2a2a2a";

  let borderColor = borderBase;
  let glowStyle = "";
  if (isSelected) {
    borderColor = "#c8941a";
    glowStyle = "0 0 0 2px #c8941a55";
  } else if (isMoveTarget) {
    borderColor = "#c8941a";
    glowStyle = "0 0 8px 2px #c8941a88";
  } else if (isInMoveMode) {
    borderColor = "#333";
  } else if (awaitingGarrison) {
    borderColor = "#f0b429";
    glowStyle = "0 0 0 2px #f0b42944";
  } else if (contested) {
    borderColor = "#c05050";
    glowStyle = "0 0 6px 1px #c0505066";
  }

  const controllerColor =
    spineColor ?? holdSpineColor(controller, homeFaction);
  const spineWho = holdSpineOwner(controller, homeFaction);
  const controllerLabel =
    controller === "north" || controller === "westerlands"
      ? `Held by ${FACTION_NAMES[controller]}`
      : controller === "hostile"
        ? "Held against both sides"
        : spineWho === "north" || spineWho === "westerlands"
          ? `Unheld — ${FACTION_NAMES[spineWho]} country`
          : "Unheld";

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        style={{
          background: bg,
          border: `1px solid ${borderColor}`,
          boxShadow: glowStyle || undefined,
          borderRadius: 2,
          padding: "4px 7px 4px 10px",
          minWidth: 90,
          maxWidth: 130,
          cursor: "pointer",
          userSelect: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          position: "relative",
          overflow: "hidden",
          opacity: isInMoveMode && !isMoveTarget && !isSelected ? 0.6 : 1,
        }}
        title={controllerLabel}
      >
        {/*
          Dedicated strip — not borderLeft. React's style diff will re-apply the
          `border` shorthand after the first update and silently drop borderLeft
          if that colour string did not change, which is why the spine vanished
          after turn 1.
        */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: mapView === "seats" ? 5 : 3,
            background: controllerColor,
            pointerEvents: "none",
          }}
        />
        {/* Hold name */}
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: isSelected ? "#c4a35a" : isMoveTarget ? "#e0c07a" : "#d8cbb4",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>

        {showHosts && hasArmies && (
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 4,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {northArmies.length > 0 && (
              <FactionStack
                faction="north"
                armies={northArmies}
                onClick={onArmyClick}
              />
            )}
            {westArmies.length > 0 && (
              <FactionStack
                faction="westerlands"
                armies={westArmies}
                onClick={onArmyClick}
              />
            )}
          </div>
        )}

        {showSeats && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 8,
              color: "#9a8a70",
              marginTop: 2,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {controller === "north"
              ? "North"
              : controller === "westerlands"
                ? "West"
                : controller === "hostile"
                  ? "Hostile"
                  : "Unheld"}
          </div>
        )}

        {showCountry && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 8,
              color: "#9a8a70",
              marginTop: 2,
            }}
            title={FORAGE_WORD[forageStep]}
          >
            {FORAGE_WORD[forageStep]}
          </div>
        )}

        {((showSeats && garrisonBand) ||
          (showHosts && (underSiege || termsState))) && (
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 2,
              alignItems: "center",
              fontFamily: MONO,
              fontSize: 7,
              letterSpacing: "0.06em",
            }}
          >
            {showSeats && garrisonBand && (
              <span
                title={`Garrison ${garrisonMen?.toLocaleString() ?? "?"} — ${BAND_LABEL[garrisonBand]}`}
                style={{ color: BAND_COLOR[garrisonBand] }}
              >
                {BAND_GLYPH[garrisonBand]}
              </span>
            )}
            {showHosts && underSiege && besiegerFaction && (
              <span
                title={`Invested by ${FACTION_NAMES[besiegerFaction]} — day ${siegeTurns ?? 1}${
                  siegeUnderStrength ? " (too few to hold the ring)" : ""
                }`}
                style={{
                  color: FACTION_COLORS[besiegerFaction],
                  fontWeight: 700,
                  opacity: siegeUnderStrength ? 0.6 : 1,
                }}
              >
                ⊘{siegeTurns ?? 1}
                {siegeUnderStrength ? "!" : ""}
              </span>
            )}
            {showHosts && termsState && (
              <span
                title={
                  termsState === "offered"
                    ? "Terms on the table"
                    : termsState === "accepted"
                      ? "Terms accepted — the seat has yielded"
                      : "Terms refused"
                }
                style={{
                  color:
                    termsState === "offered"
                      ? "#c8941a"
                      : termsState === "accepted"
                        ? "#5ecb6b"
                        : "#a05050",
                }}
              >
                ⚐
              </span>
            )}
          </div>
        )}

        {showSeats && awaitingGarrison && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 7,
              color: "#f0b429",
              marginTop: 2,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
            title="Taken — walls empty. Posting a garrison is optional."
          >
            ⚑ empty
          </div>
        )}

        {showHosts && contested && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 7,
              color: "#d06868",
              marginTop: 2,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
            title="Hosts of both sides stand here — a battle will be fought"
          >
            ⚔ contested
          </div>
        )}

        {/* Move target indicator */}
        {isMoveTarget && (
          <div
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#c8941a",
              boxShadow: "0 0 4px #c8941a",
            }}
          />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

export default HoldNode;
