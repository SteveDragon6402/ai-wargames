"use client";

import { useState } from "react";
import type { BattleReport, Casualty, DefeatType, FallenFigure } from "../types";
import { HOLDS_MAP } from "../data/holds";

const DEFEAT_TYPE_LABELS: Record<DefeatType, string> = {
  structured_withdrawal: "Structured Withdrawal",
  rout: "Rout",
  shattering: "Shattering",
  pyrrhic_win: "Pyrrhic Victory",
  last_stand: "Last Stand",
};

const DEFEAT_TYPE_COLORS: Record<DefeatType, string> = {
  structured_withdrawal: "#555",
  rout: "#c87830",
  shattering: "#b03030",
  pyrrhic_win: "#c8941a",
  last_stand: "#8b1a1a",
};

interface Props {
  reports: BattleReport[];
  onClose: () => void;
}

const HOLD_RESULT_LABELS: Record<BattleReport["holdResult"], string> = {
  north: "North holds",
  westerlands: "Westerlands holds",
  abandoned: "Both sides withdraw",
};

const HOLD_RESULT_COLORS: Record<BattleReport["holdResult"], string> = {
  north: "#3a6ea8",
  westerlands: "#b03030",
  abandoned: "#555",
};

/** Highlight names of commanders and notables in a narrative paragraph. */
function HighlightedNarrative({
  text,
  names,
}: {
  text: string;
  names: string[];
}) {
  if (names.length === 0) {
    return <span>{text}</span>;
  }

  // Build regex that matches any of the names (word-boundary safe)
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        names.includes(part) ? (
          <span
            key={i}
            style={{
              color: "#c8941a",
              fontWeight: 700,
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function CasualtyTable({ casualties }: { casualties: Casualty[] }) {
  const northCas = casualties.filter((c) => c.faction === "north");
  const westCas = casualties.filter((c) => c.faction === "westerlands");

  const Section = ({
    label,
    items,
    color,
  }: {
    label: string;
    items: Casualty[];
    color: string;
  }) => {
    if (items.length === 0) return null;
    const total = items.reduce((s, c) => s + c.count, 0);
    return (
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 8,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color,
            marginBottom: 4,
          }}
        >
          {label} — {total.toLocaleString()} fallen
        </div>
        {items.map((c, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#666",
              paddingLeft: 8,
            }}
          >
            <span>
              {c.house} {c.unitType}
            </span>
            <span style={{ color: "#aaa" }}>{c.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <Section label="The North" items={northCas} color="#6aaad8" />
      <Section label="The Westerlands" items={westCas} color="#d87070" />
    </div>
  );
}

function FallenList({ fallen }: { fallen: FallenFigure[] }) {
  if (fallen.length === 0) return null;
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 8,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#8b1a1a",
          marginBottom: 4,
        }}
      >
        Fallen
      </div>
      {fallen.map((f, i) => (
        <div
          key={i}
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            color: "#555",
            textDecoration: "line-through",
            paddingLeft: 8,
          }}
        >
          {f.name} {f.isLeader ? "(Commander)" : "(Notable)"}
        </div>
      ))}
    </div>
  );
}

function BattleModal({
  report,
  onClose,
}: {
  report: BattleReport;
  onClose: () => void;
}) {
  const hold = HOLDS_MAP.get(report.holdId);

  // Collect all names to highlight in the narrative
  const allNames: string[] = [];
  report.casualties.forEach((c) => {
    // House names aren't proper nouns to highlight, skip
  });
  report.fallen.forEach((f) => allNames.push(f.name));
  // Add well-known faction names
  ["Stark", "Lannister", "Bolton", "Manderly", "Umber", "Glover"].forEach((n) =>
    allNames.push(n)
  );

  const resultColor = HOLD_RESULT_COLORS[report.holdResult];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 620,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid #2a2a2a",
          background: "#0d0d0d",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1e1e1e",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#c8941a",
              }}
            >
              {hold?.name ?? report.holdId}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <span style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 9,
                color: "#444",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}>
                Turn {report.turn}
              </span>
              <span style={{ color: resultColor, fontFamily: "var(--font-mono), monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                · {HOLD_RESULT_LABELS[report.holdResult]}
              </span>
              {report.defeatType && (
                <span style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: DEFEAT_TYPE_COLORS[report.defeatType],
                  border: `1px solid ${DEFEAT_TYPE_COLORS[report.defeatType]}40`,
                  padding: "1px 6px",
                }}>
                  {DEFEAT_TYPE_LABELS[report.defeatType]}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              color: "#444",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#aaa")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Narrative */}
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 8,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#333",
                marginBottom: 8,
              }}
            >
              Chronicle
            </div>
            {report.narrative.split(/\n+/).map((para, i) => (
              <p
                key={i}
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 11,
                  color: "#aaa",
                  lineHeight: 1.8,
                  marginBottom: 10,
                }}
              >
                <HighlightedNarrative text={para} names={allNames} />
              </p>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #1a1a1a" }} />

          {/* Casualties */}
          {report.casualties.length > 0 && (
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 8,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: "#333",
                  marginBottom: 8,
                }}
              >
                Casualties
              </div>
              <CasualtyTable casualties={report.casualties} />
            </div>
          )}

          {/* Fallen figures */}
          {report.fallen.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid #1a1a1a" }} />
              <FallenList fallen={report.fallen} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BattleSummaries({ reports, onClose }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const expandedReport = reports.find((r) => r.id === expandedId);

  return (
    <>
      {/* Panel */}
      <div
        style={{
          borderTop: "1px solid #1e1e1e",
          background: "#0a0a0a",
          flexShrink: 0,
          maxHeight: 220,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 14px",
            borderBottom: "1px solid #1a1a1a",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#c8941a",
            }}
          >
            Battle Log — {reports.length} engagement{reports.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: "#444",
              background: "none",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
          >
            ▼ hide
          </button>
        </div>

        {/* Battle list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {reports.length === 0 ? (
            <div
              style={{
                padding: "20px 14px",
                fontFamily: "var(--font-mono), monospace",
                fontSize: 9,
                color: "#2a2a2a",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                textAlign: "center",
              }}
            >
              No battles yet
            </div>
          ) : (
            [...reports].reverse().map((report) => {
              const hold = HOLDS_MAP.get(report.holdId);
              const resultColor = HOLD_RESULT_COLORS[report.holdResult];
              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setExpandedId(report.id)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 14px",
                    borderBottom: "1px solid #141414",
                    background: "transparent",
                    border: "none",
                    borderBottomColor: "#141414",
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#0f0f0f")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 9,
                        color: "#888",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <span style={{ color: "#444" }}>T{report.turn} · </span>
                      {hold?.name ?? report.holdId}
                      <span style={{ color: resultColor, marginLeft: 8 }}>
                        · {HOLD_RESULT_LABELS[report.holdResult]}
                      </span>
                    </span>
                    {report.defeatType && (
                      <span style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 7,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: DEFEAT_TYPE_COLORS[report.defeatType],
                        border: `1px solid ${DEFEAT_TYPE_COLORS[report.defeatType]}40`,
                        padding: "1px 5px",
                      }}>
                        {DEFEAT_TYPE_LABELS[report.defeatType]}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 9,
                      color: "#333",
                    }}
                  >
                    ▶
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
      {expandedReport && (
        <BattleModal
          report={expandedReport}
          onClose={() => setExpandedId(null)}
        />
      )}
    </>
  );
}
