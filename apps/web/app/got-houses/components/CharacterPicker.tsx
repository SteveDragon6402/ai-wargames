"use client";

import type { CharacterState, GameAction, GameState, NpcRuntimePatch } from "../types";
import {
  buildDirectInviteThread,
  buildWarCouncilThread,
  enemyLordId,
  factionLordId,
  snapshotForApi,
} from "../lib/converse-client";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  /** When true, fills the talk hub instead of floating */
  embedded?: boolean;
}

export default function CharacterPicker({ state, dispatch, embedded }: Props) {
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
    const key = c.armyId ?? "unassigned";
    const list = notablesByArmy.get(key) ?? [];
    list.push(c);
    notablesByArmy.set(key, list);
  }

  async function inviteNpc(toId: string) {
    const thread = buildDirectInviteThread(
      myLord,
      toId,
      state.turn,
      state.characters
    );
    dispatch({ type: "UPSERT_CONVERSATION", thread });

    const snap = snapshotForApi(state);
    try {
      const res = await fetch("/api/got-houses/converse/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...snap,
          fromCharacterId: myLord,
          toCharacterId: toId,
          turn: state.turn,
        }),
      });
      const data = (await res.json()) as {
        accept?: boolean;
        reason?: string;
        patches?: NpcRuntimePatch[];
        error?: string;
      };

      if (data.patches?.length) {
        dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
      }

      if (data.accept) {
        const active = {
          ...thread,
          status: "active" as const,
          messages: [
            ...thread.messages,
            {
              id: `msg-${Date.now()}`,
              speakerId: toId,
              speakerName: state.characters[toId]?.name ?? toId,
              text: data.reason ?? "I will speak with you.",
              at: Date.now(),
              kind: "chat" as const,
            },
          ],
        };
        dispatch({ type: "UPSERT_CONVERSATION", thread: active });
        dispatch({ type: "OPEN_CONVERSATION", threadId: active.id });
      } else {
        const closed = {
          ...thread,
          status: "closed" as const,
          closedReason: data.reason ?? "Declined.",
          messages: [
            ...thread.messages,
            {
              id: `msg-${Date.now()}`,
              speakerId: toId,
              speakerName: state.characters[toId]?.name ?? toId,
              text: data.reason ?? "Not now.",
              at: Date.now(),
              kind: "system" as const,
            },
          ],
        };
        dispatch({ type: "UPSERT_CONVERSATION", thread: closed });
        dispatch({ type: "OPEN_CONVERSATION", threadId: closed.id });
      }
    } catch (err) {
      console.error("Invite failed", err);
    }
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
        Invite a vassal, open your war council, or send word to the enemy lord.
      </div>

      <Section title="War council">
        <Row
          label="Assemble the council"
          sub="Your major commanders in one room"
          accent
          onClick={openWarCouncil}
        />
      </Section>

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
            sub="Invite to private word"
            onClick={() => inviteNpc(c.id)}
          />
        ))}
      </Section>

      <Section title="Vassals & notables">
        {[...notablesByArmy.entries()].map(([armyId, list]) => {
          const army = state.armies.find((a) => a.id === armyId);
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
                {army?.name ?? armyId}
              </div>
              {list.map((c) => (
                <Row
                  key={c.id}
                  label={c.name}
                  sub="Invite"
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
        background: accent ? "#14120c" : "#141414",
        border: `1px solid ${accent ? "#3a2a00" : "#222"}`,
        color: "#ddd",
        padding: "12px 12px",
        marginBottom: 6,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
      }}
    >
      <div style={{ color: accent ? "#c8941a" : "#ddd" }}>{label}</div>
      {sub && (
        <div style={{ color: "#666", fontSize: 11, marginTop: 3 }}>{sub}</div>
      )}
    </button>
  );
}
