"use client";

import { useState } from "react";
import type { CharacterState, GameAction, GameState } from "../types";
import {
  buildDirectInviteThread,
  buildWarCouncilThread,
  enemyLordId,
  factionLordId,
  startDirectNpcTalk,
} from "../lib/converse-client";
import {
  ensureGarrisonNegotiator,
  findNamedGarrisonNegotiator,
  negotiatorLabel,
} from "../lib/castellan";
import { HOLDS_MAP } from "../data/holds";
import { garrisonHeadcount, isGarrisonable } from "../lib/hold-runtime";
import { getCastleSeed } from "../data/castles";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  /** When true, fills the talk hub instead of floating */
  embedded?: boolean;
}

export default function CharacterPicker({ state, dispatch, embedded }: Props) {
  const [inviteError, setInviteError] = useState<string | null>(null);
  if (!embedded && !state.talkPickerOpen) return null;

  const faction = state.activeFaction;
  const myLord = factionLordId(faction);
  const enemy = enemyLordId(faction);

  const commanders = Object.values(state.characters).filter(
    (c) =>
      c.kind === "npc" &&
      c.alive &&
      c.faction === faction &&
      c.role === "commander"
  );
  const notablesByArmy = new Map<string, CharacterState[]>();
  for (const c of Object.values(state.characters)) {
    if (c.kind !== "npc" || !c.alive || c.faction !== faction || c.role !== "notable") {
      continue;
    }
    const key = c.armyId ?? (c.holdId ? `garrison:${c.holdId}` : "unassigned");
    const list = notablesByArmy.get(key) ?? [];
    list.push(c);
    notablesByArmy.set(key, list);
  }

  // Castles you can parley with: only seats you are investing
  const castleTalkTargets: { holdId: string; label: string; sub: string }[] = [];
  for (const [holdId, hs] of Object.entries(state.holdStates ?? {})) {
    const seed = getCastleSeed(holdId);
    if (!isGarrisonable(seed)) continue;
    const men = garrisonHeadcount(hs.garrison);
    if (men <= 0 && !hs.siege) continue;

    const besieging = hs.siege?.besiegerFaction === faction;
    if (!besieging) continue;

    const named = findNamedGarrisonNegotiator(
      holdId,
      state.holdStates,
      state.characters
    );
    const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
    if (named) {
      const lab = negotiatorLabel(named, state.characters);
      castleTalkTargets.push({
        holdId,
        label: `${lab.name} · ${holdName}`,
        sub: "Parley under siege",
      });
    } else {
      castleTalkTargets.push({
        holdId,
        label: `Castellan of ${holdName}`,
        sub: "Ephemeral castellan — siege memory",
      });
    }
  }

  async function inviteNpc(toId: string) {
    setInviteError(null);
    const err = await startDirectNpcTalk(state, dispatch, toId);
    if (err) setInviteError(err);
  }

  async function talkToCastle(holdId: string) {
    setInviteError(null);
    const ensured = ensureGarrisonNegotiator(
      holdId,
      state.holdStates ?? {},
      state.characters
    );
    if (!ensured) {
      setInviteError("No negotiator available at this seat.");
      return;
    }
    dispatch({
      type: "APPLY_NEGOTIATOR_ENSURE",
      characters: ensured.characters,
      holdStates: ensured.holdStates,
    });
    const err = await startDirectNpcTalk(
      state,
      dispatch,
      ensured.negotiatorId,
      {
        characters: ensured.characters,
        holdStates: ensured.holdStates,
      }
    );
    if (err) setInviteError(err);
  }

  function inviteEnemyLord() {
    const thread = buildDirectInviteThread(
      myLord,
      enemy,
      state.turn,
      state.characters
    );
    dispatch({ type: "UPSERT_CONVERSATION", thread });
    dispatch({ type: "OPEN_CONVERSATION", threadId: thread.id });
  }

  function openWarCouncil() {
    const existing = state.conversations.find(
      (t) =>
        t.kind === "war_council" &&
        t.faction === faction &&
        t.status === "active"
    );
    if (existing) {
      dispatch({ type: "OPEN_CONVERSATION", threadId: existing.id });
      return;
    }
    const thread = buildWarCouncilThread(faction, state.turn, state.characters);
    dispatch({ type: "UPSERT_CONVERSATION", thread });
    dispatch({ type: "OPEN_CONVERSATION", threadId: thread.id });
  }

  return (
    <div
      style={{
        flex: embedded ? 1 : undefined,
        minHeight: 0,
        overflowY: "auto",
        background: embedded ? "transparent" : "#0e0e0e",
        border: embedded ? "none" : "1px solid #2a2a2a",
        padding: embedded ? "16px 18px" : 12,
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      <div
        style={{
          color: "#c8941a",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: 6,
        }}
      >
        Who will you speak with?
      </div>
      <div style={{ color: "#555", fontSize: 11, marginBottom: 18, lineHeight: 1.4 }}>
        Speak with a vassal, open your war council, parley with a castle, or send word to the enemy lord.
      </div>
      {inviteError && (
        <div
          style={{
            color: "#c05050",
            fontSize: 10,
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
          {inviteError}
        </div>
      )}

      <Section title="War council">
        <Row
          label="Assemble the council"
          sub="Your major commanders in one room"
          accent
          onClick={openWarCouncil}
        />
      </Section>

      {castleTalkTargets.length > 0 && (
        <Section title="Castles & garrisons">
          {castleTalkTargets.map((t) => (
            <Row
              key={t.holdId}
              label={t.label}
              sub={t.sub}
              onClick={() => talkToCastle(t.holdId)}
            />
          ))}
        </Section>
      )}

      <Section title="Enemy lord">
        <Row
          label={state.characters[enemy]?.name ?? enemy}
          sub="Send invitation"
          onClick={inviteEnemyLord}
        />
      </Section>

      <Section title="Commanders">
        {commanders.map((c) => (
          <Row
            key={c.id}
            label={c.name}
            sub="Private word"
            onClick={() => inviteNpc(c.id)}
          />
        ))}
      </Section>

      <Section title="Vassals & notables">
        {[...notablesByArmy.entries()].map(([armyId, list]) => {
          const army = state.armies.find((a) => a.id === armyId);
          const garrisonHold = armyId.startsWith("garrison:")
            ? HOLDS_MAP.get(armyId.slice("garrison:".length))?.name
            : null;
          return (
            <div key={armyId} style={{ marginBottom: 12 }}>
              <div
                style={{
                  color: "#444",
                  fontSize: 10,
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {army?.name ??
                  (garrisonHold ? `Garrison · ${garrisonHold}` : armyId)}
              </div>
              {list.map((c) => (
                <Row
                  key={c.id}
                  label={c.name}
                  sub={
                    c.kind === "npc" && c.species === "beast"
                      ? "Beast — not a negotiator"
                      : "Private word"
                  }
                  onClick={() => inviteNpc(c.id)}
                />
              ))}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          color: "#6a8a6a",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  sub,
  onClick,
  accent,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: accent ? "#1a1200" : "#0a0a0a",
        border: accent ? "1px solid #3a2a00" : "1px solid #1e1e1e",
        padding: "8px 10px",
        marginBottom: 6,
        cursor: "pointer",
        color: "#ccc",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: accent ? "#c8941a" : "#bbb",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{sub}</div>
    </button>
  );
}
