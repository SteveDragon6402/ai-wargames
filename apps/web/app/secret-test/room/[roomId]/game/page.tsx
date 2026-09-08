"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ValdenMap from "../../../components/ValdenMap";
import { formatKr } from "../../../lib/lean";
import { wordCount } from "../../../lib/words";
import { STATES } from "../../../data/valden";
import {
  CAMPAIGN_LABEL,
  MAX_ACTION_WORDS,
  MAX_DEBATE_WORDS,
  isDebateMonth,
  type FactionId,
  type SecretTestSnapshot,
  type Winner,
} from "../../../types";

export default function SecretTestGamePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<SecretTestSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [debate, setDebate] = useState<string[]>(["", "", ""]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [openMonths, setOpenMonths] = useState<Set<number>>(() => new Set());
  const resolveInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/secret-test/rooms/${roomId}`);
      const data = (await res.json()) as SecretTestSnapshot & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Unknown room.");
        return;
      }
      if (data.room.status === "lobby") {
        router.replace(`/secret-test/room/${roomId}/lobby`);
        return;
      }
      setSnapshot(data);
    } catch {
      setError("Failed to reach the desk.");
    } finally {
      setLoading(false);
    }
  }, [roomId, router]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const chronicle = snapshot?.game?.chronicle;
    if (!chronicle?.length) return;
    const latest = Math.max(...chronicle.map((e) => e.month));
    setOpenMonths((prev) => {
      if (prev.has(latest)) return prev;
      const next = new Set(prev);
      next.add(latest);
      return next;
    });
  }, [snapshot?.game?.chronicle]);

  useEffect(() => {
    const phase = snapshot?.game?.phase;
    if (phase !== "resolving" || !roomId || resolveInFlight.current) return;
    resolveInFlight.current = true;
    fetch(`/api/secret-test/rooms/${roomId}/resolve`, { method: "POST" })
      .catch(() => {})
      .finally(() => {
        resolveInFlight.current = false;
        refresh();
      });
  }, [snapshot?.game?.phase, roomId, refresh]);

  async function submit() {
    if (!roomId || !snapshot?.game) return;
    setSending(true);
    setSendError("");
    try {
      const debateOn = isDebateMonth(snapshot.game.month) && snapshot.game.debateQuestions.length > 0;
      const res = await fetch(`/api/secret-test/rooms/${roomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: draft,
          debateAnswers: debateOn ? debate : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not file the plan.");
      setDraft("");
      setDebate(["", "", ""]);
      await refresh();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main style={center}>
        <p className="rose-label">Laying out the map…</p>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main style={center}>
        <p className="rose-error">{error || "Unknown room."}</p>
        <Link href="/secret-test" className="rose-link" style={{ marginTop: 16 }}>← Return</Link>
      </main>
    );
  }

  if (!snapshot.viewer || !snapshot.game) {
    return (
      <main style={center}>
        <p className="rose-error">Your session is not in this race.</p>
        <Link href="/secret-test" className="rose-link" style={{ marginTop: 16 }}>← Return</Link>
      </main>
    );
  }

  const { game, viewer } = snapshot;
  const house = viewer.factionId;
  const houseColor = house === "red" ? "#e07070" : "#7a9ae0";

  if (game.phase === "ended" && game.winner) {
    return <EndScreen house={house} winner={game.winner} viewerName={viewer.displayName} />;
  }

  const words = wordCount(draft);
  const over = words > MAX_ACTION_WORDS;
  const submitted = Boolean(game.myPendingAction);
  const resolving = game.phase === "resolving";
  const debateOn = isDebateMonth(game.month) && game.debateQuestions.length > 0;
  const debateOver = debateOn && game.debateQuestions.some((_, i) => wordCount(debate[i] ?? "") > MAX_DEBATE_WORDS);

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      {resolving && (
        <div className="rose-overlay">
          <p className="rose-serif" style={{ fontSize: 20, color: "#ece8df", fontStyle: "italic" }}>
            Staff are working the month…
          </p>
        </div>
      )}

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 20px",
          borderBottom: "1px solid #1e1e22",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="rose-serif" style={{ fontSize: 18, color: houseColor }}>
            {CAMPAIGN_LABEL[house]} · {viewer.displayName}
          </div>
          <div className="rose-label">Month {game.month} / 12</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="rose-serif" style={{ fontSize: 18 }}>{formatKr(game.cash)}</div>
          <div className="rose-label">Your pot</div>
          {game.opponentRumor && (
            <div className="rose-serif" style={{ fontSize: 13, color: "#8a8a86", maxWidth: 280 }}>
              {game.opponentRumor}
            </div>
          )}
        </div>
      </header>

      <ValdenMap seats={game.map} />

      <div className="rose-desk">
        <div>
          {game.briefing ? (
            <article className="rose-letter">
              <div className="rose-label" style={{ color: "#6e5724", marginBottom: 10 }}>
                Chief of staff — month {game.month}
              </div>
              <div className="rose-letter-body">{game.briefing}</div>
              {game.recommendations.length > 0 && (
                <ul style={{ marginTop: 16, paddingLeft: 18, color: "#1c1c1e" }}>
                  {game.recommendations.map((r, i) => (
                    <li key={i} className="rose-serif" style={{ marginBottom: 4 }}>
                      {r.action} — {formatKr(r.costKr)}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : (
            <article className="rose-letter">
              <p className="rose-serif" style={{ fontStyle: "italic" }}>
                Waiting on the first staff memo.
              </p>
            </article>
          )}

          {game.issues.length > 0 && (
            <p className="rose-serif" style={{ color: "#9a9890", marginTop: 12, fontSize: 14 }}>
              Live issues (opine in your directive or stay silent): {game.issues.join(" · ")}
            </p>
          )}

          <div className="rose-composer" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="rose-label" style={{ color: "#6e5724" }}>This month’s directives</div>
              {!submitted && (
                <div className="rose-label" style={{ color: over ? "#c42828" : "#6e5724" }}>
                  {words} / {MAX_ACTION_WORDS}
                </div>
              )}
            </div>
            {submitted ? (
              <div>
                <p className="rose-serif" style={{ fontSize: 16, whiteSpace: "pre-wrap" }}>{game.myPendingAction}</p>
                {game.myPendingDebate && (
                  <div style={{ marginTop: 12 }}>
                    {game.myPendingDebate.map((a, i) => (
                      <p key={i} className="rose-serif" style={{ fontSize: 15, marginBottom: 8 }}>
                        Q{i + 1}: {a}
                      </p>
                    ))}
                  </div>
                )}
                <p className="rose-serif" style={{ marginTop: 14, fontStyle: "italic", color: "#5a564c" }}>
                  {game.opponentSubmitted ? "Both plans are in." : "Waiting on the other campaign."}
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="One package this month. Visit 1–2 adjacent seats, or a speech, or media, or a fundraiser. If you do not take a line on the issues, you stay mute."
                  disabled={resolving || sending}
                />
                {debateOn && (
                  <div style={{ marginTop: 16 }}>
                    <div className="rose-label" style={{ marginBottom: 8 }}>Debate — same questions as the other campaign</div>
                    {game.debateQuestions.map((q, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div className="rose-serif" style={{ fontSize: 15, marginBottom: 4 }}>{q}</div>
                        <textarea
                          value={debate[i] ?? ""}
                          onChange={(e) => {
                            const next = [...debate];
                            next[i] = e.target.value;
                            setDebate(next);
                          }}
                          style={{ minHeight: 72 }}
                          disabled={resolving || sending}
                        />
                        <div className="rose-label">
                          {wordCount(debate[i] ?? "")} / {MAX_DEBATE_WORDS}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button
                    type="button"
                    className="rose-btn"
                    style={{ color: "#3a2a10", borderColor: "#6e5724", background: "#d4c4a4" }}
                    disabled={resolving || sending || over || debateOver || !draft.trim()}
                    onClick={submit}
                  >
                    {sending ? "Filing…" : "File with the chief of staff"}
                  </button>
                </div>
                {sendError && <p className="rose-error" style={{ marginTop: 12 }}>{sendError}</p>}
              </>
            )}
          </div>
        </div>

        <aside>
          <div className="rose-label" style={{ marginBottom: 12, color: "#6e5724" }}>Your months</div>
          {game.chronicle.length === 0 ? (
            <p className="rose-serif" style={{ fontStyle: "italic", color: "#6a6a6e", fontSize: 15 }}>
              Month 1 has not closed.
            </p>
          ) : (
            [...game.chronicle].reverse().map((entry) => {
              const open = openMonths.has(entry.month);
              return (
                <div key={entry.month} className="rose-panel" style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMonths((prev) => {
                        const next = new Set(prev);
                        if (next.has(entry.month)) next.delete(entry.month);
                        else next.add(entry.month);
                        return next;
                      });
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      color: "#d8d6d0",
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span className="rose-label">Month {entry.month}</span>
                  </button>
                  {open && (
                    <div style={{ padding: "0 12px 14px" }}>
                      <p className="rose-serif" style={{ fontSize: 14, color: "#a89c88", whiteSpace: "pre-wrap" }}>
                        {entry.briefing}
                      </p>
                      <p className="rose-serif" style={{ fontSize: 14, color: "#c8c0b0", whiteSpace: "pre-wrap", marginTop: 8 }}>
                        {entry.action}
                      </p>
                      {entry.note && (
                        <p className="rose-serif" style={{ fontSize: 13, color: "#8a8a86", marginTop: 8, fontStyle: "italic" }}>
                          {entry.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </aside>
      </div>
    </div>
  );
}

function EndScreen({
  house,
  winner,
  viewerName,
}: {
  house: FactionId;
  winner: Winner;
  viewerName: string;
}) {
  const won = winner.factionId === house;
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "36px 20px 80px" }}>
      <p className="rose-label" style={{ color: "#6e5724" }}>Election night · Valden</p>
      <h1 className="rose-title" style={{ fontSize: 36, margin: "8px 0 12px" }}>
        {CAMPAIGN_LABEL[winner.factionId]} takes the presidency
      </h1>
      <p className="rose-serif" style={{ color: won ? "#c8b070" : "#8a8a86", fontStyle: "italic" }}>
        {viewerName} — you ran {CAMPAIGN_LABEL[house]}. {won ? "You won." : "You lost."}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        {STATES.map((s) => {
          const who = winner.states[s.id];
          const color = who === "red" ? "#c42828" : who === "blue" ? "#2b54a8" : "#6a6a6e";
          return (
            <span key={s.id} className="rose-label" style={{ border: `1px solid ${color}`, color, padding: "4px 8px" }}>
              {s.name}: {who}
            </span>
          );
        })}
      </div>
      <article className="rose-letter" style={{ marginTop: 24 }}>
        <div className="rose-label" style={{ color: "#6e5724", marginBottom: 8 }}>Verdict</div>
        <div className="rose-letter-body">{winner.reason}</div>
      </article>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18 }}>
        <article className="rose-letter">
          <div className="rose-label" style={{ color: "#c42828", marginBottom: 8 }}>On the red campaign</div>
          <div className="rose-letter-body" style={{ fontSize: 16 }}>{winner.breakdowns.red}</div>
        </article>
        <article className="rose-letter">
          <div className="rose-label" style={{ color: "#2b54a8", marginBottom: 8 }}>On the blue campaign</div>
          <div className="rose-letter-body" style={{ fontSize: 16 }}>{winner.breakdowns.blue}</div>
        </article>
      </div>
      <div style={{ marginTop: 28 }}>
        <Link href="/secret-test" className="rose-link">← Open another campaign</Link>
      </div>
    </main>
  );
}

const center: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
