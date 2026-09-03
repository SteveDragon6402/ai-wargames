"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RoseGlyph } from "../../../components/RoseGlyph";
import { HOUSE_LABEL, HOUSE_SHORT, MAX_ACTION_WORDS, type FactionId, type SecretTestSnapshot, type Winner } from "../../../types";
import { wordCount } from "../../../lib/words";

export default function SecretTestGamePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<SecretTestSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [openTurns, setOpenTurns] = useState<Set<number>>(() => new Set());
  const resolveInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/secret-test/rooms/${roomId}`);
      const data = (await res.json()) as SecretTestSnapshot & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "The cipher is unknown.");
        return;
      }
      if (data.room.status === "lobby") {
        router.replace(`/secret-test/room/${roomId}/lobby`);
        return;
      }
      setSnapshot(data);
    } catch {
      setError("Failed to reach the council.");
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
    const latest = Math.max(...chronicle.map((e) => e.turn));
    setOpenTurns((prev) => {
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

  async function sealAndSend() {
    if (!roomId) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/secret-test/rooms/${roomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The seal would not take.");
      setDraft("");
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
        <p className="rose-label">The desk is being laid…</p>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main style={center}>
        <p className="rose-error">{error || "The cipher is unknown."}</p>
        <Link href="/secret-test" className="rose-link" style={{ marginTop: 16 }}>
          ← Return
        </Link>
      </main>
    );
  }

  if (!snapshot.viewer || !snapshot.game) {
    return (
      <main style={center}>
        <p className="rose-error">Your session is not in this council.</p>
        <Link href="/secret-test" className="rose-link" style={{ marginTop: 16 }}>
          ← Return
        </Link>
      </main>
    );
  }

  const { game, viewer } = snapshot;
  const house = viewer.factionId;
  const houseColor = house === "lancaster" ? "#c45c5c" : "#cfc8b8";

  if (game.phase === "ended" && game.winner) {
    return <EndScreen house={house} winner={game.winner} viewerName={viewer.displayName} />;
  }

  const words = wordCount(draft);
  const over = words > MAX_ACTION_WORDS;
  const submitted = Boolean(game.myPendingAction);
  const resolving = game.phase === "resolving";
  const phaseLine = resolving
    ? "Couriers riding…"
    : submitted
      ? "Your letter awaits a reply"
      : "Your letter awaits the seal";

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      {resolving && (
        <div className="rose-overlay">
          <p className="rose-serif" style={{ fontSize: 22, color: "#e8dcc4", fontStyle: "italic" }}>
            The chronicler is gathering reports…
          </p>
        </div>
      )}

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "16px 24px",
          borderBottom: "1px solid #1e1a14",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RoseGlyph house={house} size={28} />
          <div>
            <div className="rose-serif" style={{ fontSize: 18, color: houseColor }}>
              {HOUSE_LABEL[house]}
            </div>
            <div className="rose-label">{viewer.displayName}</div>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="rose-label">Turn {game.turn}</div>
          <div className="rose-serif" style={{ fontSize: 15, color: "#8a8070", fontStyle: "italic" }}>
            {phaseLine}
          </div>
        </div>
        <div className="rose-label" style={{ textAlign: "right" }}>
          The other rose is seated
          <div style={{ color: "#3a342c", marginTop: 4 }}>Their letters are not yours to read</div>
        </div>
      </header>

      <div className="rose-desk">
        <div>
          {game.briefing ? (
            <article className={`rose-letter house-${house} rose-letter-enter`} key={game.turn}>
              <div className={`rose-seal ${house}`}>
                <RoseGlyph house={house} size={18} />
              </div>
              <div className="rose-label" style={{ color: "#6e5724", marginBottom: 12 }}>
                Dispatch — Turn {game.turn}
              </div>
              <div className="rose-letter-body">{game.briefing}</div>
            </article>
          ) : (
            <article className="rose-letter">
              <p className="rose-serif" style={{ fontStyle: "italic", color: "#5a4e3a" }}>
                No dispatch has yet been laid upon this desk.
              </p>
            </article>
          )}

          <div className="rose-composer" style={{ marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="rose-label" style={{ color: "#6e5724" }}>
                Your orders
              </div>
              {!submitted && (
                <div
                  className="rose-label"
                  style={{ color: over ? "#7a1420" : words > 420 ? "#7a1420" : "#6e5724" }}
                >
                  {words} / {MAX_ACTION_WORDS} words
                </div>
              )}
            </div>
            {submitted ? (
              <div>
                <p className="rose-serif" style={{ fontSize: 17, whiteSpace: "pre-wrap", color: "#2a2418" }}>
                  {game.myPendingAction}
                </p>
                <p
                  className="rose-serif"
                  style={{ marginTop: 16, fontStyle: "italic", color: "#5a4e3a" }}
                >
                  {game.opponentSubmitted
                    ? "Both seals are in. The chronicler is at work."
                    : "Your riders have gone. Waiting on the other house."}
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write as a captain of the house: marches, marriages, treasure, murder, delay…"
                  disabled={resolving || sending}
                  maxLength={4000}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button
                    type="button"
                    className="rose-btn"
                    style={{ color: "#3a2a10", borderColor: "#6e5724", background: "#d4c4a4" }}
                    disabled={resolving || sending || over || !draft.trim()}
                    onClick={sealAndSend}
                  >
                    {sending ? "Sealing…" : "Seal and send"}
                  </button>
                </div>
                {sendError && <p className="rose-error" style={{ marginTop: 12 }}>{sendError}</p>}
              </>
            )}
          </div>
        </div>

        <aside>
          <div className="rose-label" style={{ marginBottom: 12, color: "#6e5724" }}>
            Your chronicle
          </div>
          {game.chronicle.length === 0 ? (
            <p className="rose-serif" style={{ fontStyle: "italic", color: "#5a5348", fontSize: 15 }}>
              The first season has not yet closed.
            </p>
          ) : (
            [...game.chronicle].reverse().map((entry) => {
              const open = openTurns.has(entry.turn);
              return (
                <div
                  key={entry.turn}
                  className="rose-panel"
                  style={{ marginBottom: 10, overflow: "hidden" }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenTurns((prev) => {
                        const next = new Set(prev);
                        if (next.has(entry.turn)) next.delete(entry.turn);
                        else next.add(entry.turn);
                        return next;
                      });
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      color: "#c8c0b0",
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span className="rose-label">Turn {entry.turn}</span>
                  </button>
                  {open && (
                    <div style={{ padding: "0 12px 14px" }}>
                      <div className="rose-label" style={{ marginBottom: 4 }}>
                        What you were told
                      </div>
                      <p
                        className="rose-serif"
                        style={{ fontSize: 14, color: "#a89c88", whiteSpace: "pre-wrap", marginBottom: 10 }}
                      >
                        {entry.briefing}
                      </p>
                      <div className="rose-label" style={{ marginBottom: 4 }}>
                        What you ordered
                      </div>
                      <p
                        className="rose-serif"
                        style={{ fontSize: 14, color: "#c8c0b0", whiteSpace: "pre-wrap" }}
                      >
                        {entry.action}
                      </p>
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
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "40px 20px 80px" }}>
      <p className="rose-label" style={{ color: "#6e5724" }}>
        England · the war is decided
      </p>
      <h1 className="rose-title" style={{ fontSize: 40, margin: "8px 0 12px" }}>
        {HOUSE_SHORT[winner.factionId]} holds England
      </h1>
      <p className="rose-serif" style={{ color: won ? "#c8b070" : "#8a8070", fontStyle: "italic" }}>
        {viewerName} — you sat for {HOUSE_LABEL[house]}. {won ? "The chronicle favours you." : "The chronicle does not."}
      </p>

      <article className="rose-letter rose-letter-enter" style={{ marginTop: 28 }}>
        <div className="rose-label" style={{ color: "#6e5724", marginBottom: 10 }}>
          A historian’s verdict
        </div>
        <div className="rose-letter-body">{winner.reason}</div>
      </article>

      <div className="rose-end-cols">
        <article className="rose-letter house-lancaster">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <RoseGlyph house="lancaster" size={22} />
            <span className="rose-label" style={{ color: "#7a1420" }}>
              On the Lancastrian
            </span>
          </div>
          <div className="rose-letter-body" style={{ fontSize: 16 }}>
            {winner.breakdowns.lancaster}
          </div>
        </article>
        <article className="rose-letter house-york">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <RoseGlyph house="york" size={22} />
            <span className="rose-label" style={{ color: "#3a3c42" }}>
              On the Yorkist
            </span>
          </div>
          <div className="rose-letter-body" style={{ fontSize: 16 }}>
            {winner.breakdowns.york}
          </div>
        </article>
      </div>
      <div style={{ marginTop: 32 }}>
        <Link href="/secret-test" className="rose-link">
          ← Raise another standard
        </Link>
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
