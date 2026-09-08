"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Army, Faction } from "../types";
import { REGION_COLORS, REGION_BORDER_COLORS } from "../data/holds";

/** Where a garrison stands relative to the seat's own default strength. */
export type GarrisonBand =
  | "empty"
  | "skeleton"
  | "at_strength"
  | "reinforced";

export interface HoldNodeData {
  id: string;
  label: string;
  region: string;
  armies: Army[];
  isSelected: boolean;
  isMoveTarget: boolean;
  isInMoveMode: boolean;
  /** Who holds the seat right now; null when unheld. */
  controller?: Faction | "hostile" | null;
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
  return army.units.reduce((s, u) => s + u.count, 0);
}

/**
 * One host, with its size.
 *
 * Five identical anonymous dots at Moat Cailin told the player nothing about
 * whether that was a screening force or the whole Northern army, so each dot
 * now carries its strength in thousands.
 */
function ArmyDot({
  army,
  fortified,
  resting,
}: {
  army: Army;
  fortified?: boolean;
  resting?: boolean;
}) {
  const men = strengthOf(army);
  const k = men >= 1000 ? `${Math.round(men / 1000)}` : "·";
  const activity = fortified ? "fortifying" : resting ? "resting" : "in the field";
  return (
    <span
      title={`${army.name} — ${men.toLocaleString()} men, ${activity}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 12,
        height: 11,
        padding: "0 2px",
        borderRadius: fortified ? 1 : 6,
        background: FACTION_COLORS[army.faction],
        border: fortified
          ? "1px solid rgba(255,255,255,0.45)"
          : "1px solid rgba(255,255,255,0.15)",
        flexShrink: 0,
        opacity: resting && !fortified ? 0.55 : 1,
        fontFamily: MONO,
        fontSize: 7,
        fontWeight: 700,
        color: "rgba(255,255,255,0.92)",
        lineHeight: 1,
      }}
    >
      {k}
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

function HoldNode({ data }: { data: HoldNodeData }) {
  const {
    label,
    region,
    armies,
    isSelected,
    isMoveTarget,
    isInMoveMode,
    controller,
    hasGarrison,
    garrisonMen,
    garrisonBand,
    underSiege,
    besiegerFaction,
    siegeTurns,
    siegeUnderStrength,
    termsState,
    awaitingGarrison,
    contested,
  } = data;

  const northArmies = armies.filter((a) => a.faction === "north");
  const westArmies = armies.filter((a) => a.faction === "westerlands");
  const hasArmies = armies.length > 0;

  const bg = REGION_COLORS[region] ?? "#111";
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
    controller === "north" || controller === "westerlands"
      ? FACTION_COLORS[controller]
      : controller === "hostile"
        ? "#6a5a3a"
        : "#333";
  const controllerLabel =
    controller === "north" || controller === "westerlands"
      ? `Held by ${FACTION_NAMES[controller]}`
      : controller === "hostile"
        ? "Held against both sides"
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
          padding: "4px 7px",
          minWidth: 90,
          maxWidth: 130,
          cursor: "pointer",
          userSelect: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          position: "relative",
          opacity: isInMoveMode && !isMoveTarget && !isSelected ? 0.4 : 1,
          // Ownership as a coloured spine down the left edge: readable at a
          // glance across the whole map, which a glyph is not.
          borderLeft: `3px solid ${controllerColor}`,
        }}
        title={controllerLabel}
      >
        {/* Hold name */}
        <div
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: isSelected ? "#c8941a" : isMoveTarget ? "#f0b429" : "#aaa",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>

        {/* Army dots row */}
        {hasArmies && (
          <div
            style={{
              display: "flex",
              gap: 3,
              marginTop: 3,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {[...northArmies, ...westArmies].map((a) => (
              <ArmyDot
                key={a.id}
                army={a}
                fortified={(a.activity?.turnsFortiying ?? 0) > 0}
                resting={(a.activity?.turnsResting ?? 0) > 0}
              />
            ))}
          </div>
        )}

        {(hasGarrison || underSiege || garrisonBand) && (
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: hasArmies ? 2 : 3,
              alignItems: "center",
              fontFamily: MONO,
              fontSize: 7,
              letterSpacing: "0.06em",
            }}
          >
            {garrisonBand && (
              <span
                title={`Garrison ${garrisonMen?.toLocaleString() ?? "?"} — ${BAND_LABEL[garrisonBand]}`}
                style={{ color: BAND_COLOR[garrisonBand] }}
              >
                {BAND_GLYPH[garrisonBand]}
              </span>
            )}
            {underSiege && besiegerFaction && (
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
            {termsState && (
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

        {awaitingGarrison && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 7,
              color: "#f0b429",
              marginTop: 2,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
            title="Taken but unmanned — post a garrison before issuing orders"
          >
            ⚑ post garrison
          </div>
        )}

        {contested && (
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

export default memo(HoldNode);
