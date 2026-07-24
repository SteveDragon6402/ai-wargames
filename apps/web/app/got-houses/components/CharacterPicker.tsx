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
}

export default function CharacterPicker({ state, dispatch }: Props) {
  if (!state.talkPickerOpen) return null;

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
        position: "absolute",
        top: 56,
        right: 12,
        width: 300,
        maxHeight: "70vh",
        overflow: "auto",
        background: "#0e0e0e",
        border: "1px solid #2a2a2a",
        zIndex: 40,
        padding: 12,
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
          color: "#aaa",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        <span>Talk to someone</span>
        <button
          type="button"
          onClick={() => dispatch({ type: "TOGGLE_TALK_PICKER" })}
          style={btnStyle}
        >
          Close
        </button>
      </div>

      <Section title="Enemy lord">
        <Row
          label={state.characters[enemy]?.name ?? enemy}
          sub="Send invitation"
          onClick={inviteEnemyLord}
        />
      </Section>

      <Section title="War council">
        <Row label="Assemble council" sub="All major commanders" onClick={openWarCouncil} />
      </Section>

      <Section title="Commanders">
        {commanders.map((c) => (
          <Row
            key={c.id}
            label={c.name}
            sub="Invite"
            onClick={() => inviteNpc(c.id)}
          />
        ))}
      </Section>

      <Section title="Vassals & notables">
        {[...notablesByArmy.entries()].map(([armyId, list]) => {
          const army = state.armies.find((a) => a.id === armyId);
          return (
            <div key={armyId} style={{ marginBottom: 8 }}>
              <div style={{ color: "#555", fontSize: 9, marginBottom: 4 }}>
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
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          color: "#6a8a6a",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: 6,
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
}: {
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "#141414",
        border: "1px solid #222",
        color: "#ccc",
        padding: "8px 10px",
        marginBottom: 4,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
      }}
    >
      <div>{label}</div>
      {sub && <div style={{ color: "#666", fontSize: 10 }}>{sub}</div>}
    </button>
  );
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #333",
  color: "#888",
  fontSize: 9,
  cursor: "pointer",
  padding: "2px 6px",
  fontFamily: "inherit",
};
