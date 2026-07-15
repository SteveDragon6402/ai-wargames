"use client";

import type { Army, UnitType } from "../types";

const FACTION_COLORS = {
  north: { border: "#1a3a5a", accent: "#3a6ea8", text: "#6aaad8" },
  westerlands: { border: "#5a1a1a", accent: "#b03030", text: "#d87070" },
};

const UNIT_ICONS: Record<UnitType, string> = {
  cavalry: "⚔",
  infantry: "🛡",
  archers: "🏹",
};

const UNIT_LABELS: Record<UnitType, string> = {
  cavalry: "Cavalry",
  infantry: "Infantry",
  archers: "Archers",
};

interface Props {
  army: Army;
  isSelected: boolean;
  hasOrder: boolean;
  isLocked: boolean;
  onClick: (armyId: string, shift: boolean) => void;
}

export default function ArmyCard({ army, isSelected, hasOrder, isLocked, onClick }: Props) {
  const colors = FACTION_COLORS[army.faction];

  const totalUnits = army.units.reduce((s, u) => s + u.count, 0);

  // Group units by type for display
  const byType = army.units.reduce<Partial<Record<UnitType, { houses: string; count: number }[]>>>(
    (acc, unit) => {
      if (!acc[unit.type]) acc[unit.type] = [];
      acc[unit.type]!.push({ houses: unit.house, count: unit.count });
      return acc;
    },
    {}
  );

  return (
    <div
      onClick={(e) => !isLocked && onClick(army.id, e.shiftKey)}
      style={{
        border: `1px solid ${isSelected ? colors.accent : colors.border}`,
        background: isSelected ? `${colors.accent}18` : "#0a0a0a",
        padding: "8px 10px",
        cursor: isLocked ? "default" : "pointer",
        transition: "border-color 0.12s, background 0.12s",
        opacity: isLocked && !isSelected ? 0.6 : 1,
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isLocked)
          e.currentTarget.style.borderColor = colors.accent;
      }}
      onMouseLeave={(e) => {
        if (!isSelected)
          e.currentTarget.style.borderColor = colors.border;
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: colors.accent,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: isSelected ? colors.text : "#aaa",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {army.name}
        </span>
        {hasOrder && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#c8941a",
              border: "1px solid #3a2a00",
              padding: "1px 4px",
              flexShrink: 0,
            }}
          >
            ORDERED
          </span>
        )}
      </div>

      {/* Leaders */}
      <div style={{ marginBottom: 6 }}>
        {army.leaders.map((l) => (
          <div
            key={l.name}
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {l.title ? `${l.name} — ${l.title}` : l.name}
          </div>
        ))}
      </div>

      {/* Notables */}
      {army.notables && army.notables.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 8,
              color: "#444",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 4,
              borderBottom: "1px solid #181818",
              paddingBottom: 3,
            }}
          >
            Notable figures
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {army.notables.map((n) => (
              <div key={n.name}>
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {n.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 8,
                    color: "#555",
                    display: "block",
                    marginTop: 1,
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  {n.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unit breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
        {(["cavalry", "infantry", "archers"] as UnitType[]).map((type) => {
          const rows = byType[type];
          if (!rows?.length) return null;
          return (
            <div key={type}>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 8,
                  color: "#444",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 1,
                }}
              >
                {UNIT_ICONS[type]} {UNIT_LABELS[type]}
              </div>
              {rows.map((row) => (
                <div
                  key={row.houses}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 9,
                    color: "#777",
                    paddingLeft: 12,
                  }}
                >
                  <span>{row.houses} men</span>
                  <span style={{ color: "#aaa" }}>{row.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #1a1a1a",
          paddingTop: 4,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 8,
            color: "#444",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Total strength
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            color: colors.text,
            fontWeight: 700,
          }}
        >
          {totalUnits.toLocaleString()}
        </span>
      </div>

      {/* Morale & Tiredness */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div>
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 8,
              color: "#444",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Morale ·{" "}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#666",
              fontStyle: "italic",
            }}
          >
            {army.morale}
          </span>
        </div>
        <div>
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 8,
              color: "#444",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Condition ·{" "}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#666",
              fontStyle: "italic",
            }}
          >
            {army.tiredness}
          </span>
        </div>
      </div>

      {/* Selected ring */}
      {isSelected && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: `1px solid ${colors.accent}`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
