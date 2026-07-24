"use client";

import { useState } from "react";
import type { Army, GameAction, GameState, NpcRuntimePatch } from "../types";
import { countWords, SPEECH_MAX_WORDS, factionLordId } from "../data/characters";

interface Props {
  army: Army;
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export default function SpeechComposer({ army, state, dispatch }: Props) {
  const [speech, setSpeech] = useState("");
  const [reaction, setReaction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const already = state.speechesThisTurn.includes(army.id);
  const inPlanning = state.phase === "planning";
  if (!inPlanning) return null;

  const commander = Object.values(state.characters).find(
    (c) => c.kind === "npc" && c.alive && c.armyId === army.id && c.role === "commander"
  );

  async function deliver() {
    if (already || busy) return;
    if (countWords(speech) === 0) return;
    if (countWords(speech) > SPEECH_MAX_WORDS) {
      alert(`Speech must be ≤ ${SPEECH_MAX_WORDS} words.`);
      return;
    }
    setBusy(true);
    try {
      const speakerId = factionLordId(army.faction);
      const res = await fetch("/api/got-houses/converse/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          army,
          speech,
          speakerName: state.characters[speakerId]?.name ?? "Lord",
          commanderId: commander?.id,
          commanderMood: commander?.kind === "npc" ? commander.mood : undefined,
        }),
      });
      const data = (await res.json()) as {
        reaction?: string;
        condition?: {
          armyId: string;
          morale: string;
          tiredness: string;
          stance?: string;
        };
        impliedOrder?: "rest" | "fortify" | "none";
        patches?: NpcRuntimePatch[];
        error?: string;
      };
      if (!res.ok || !data.condition) {
        console.error("Speech failed", data.error);
        return;
      }
      setReaction(data.reaction ?? "The men listen.");
      dispatch({
        type: "APPLY_SPEECH",
        armyId: army.id,
        reaction: data.reaction ?? "",
        condition: data.condition,
        impliedOrder: data.impliedOrder ?? "none",
        commanderPatch: data.patches?.[0],
      });
      setSpeech("");
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        borderTop: "1px solid #1e1e1e",
        padding: "10px 14px",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: "#6a8a6a",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 6,
        }}
      >
        Address this army
      </div>
      {already ? (
        <div style={{ color: "#666", fontSize: 11 }}>
          This host already heard a speech this turn.
          {reaction && (
            <div style={{ marginTop: 6, color: "#9a9a6a" }}>{reaction}</div>
          )}
        </div>
      ) : (
        <>
          <textarea
            value={speech}
            onChange={(e) => setSpeech(e.target.value)}
            rows={4}
            placeholder="Short speech — the host listens. May imply rest or fortify."
            style={{
              width: "100%",
              background: "#121212",
              border: "1px solid #2a2a2a",
              color: "#ddd",
              fontFamily: "inherit",
              fontSize: 11,
              padding: 8,
              resize: "vertical",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontSize: 9,
              color: "#555",
            }}
          >
            <span>
              {countWords(speech)}/{SPEECH_MAX_WORDS}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={deliver}
              style={{
                background: "#1a1a1a",
                border: "1px solid #333",
                color: "#c8941a",
                fontSize: 10,
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {busy ? "…" : "Deliver"}
            </button>
          </div>
          {reaction && (
            <div style={{ marginTop: 8, color: "#9a9a6a", fontSize: 11 }}>{reaction}</div>
          )}
        </>
      )}
    </div>
  );
}
