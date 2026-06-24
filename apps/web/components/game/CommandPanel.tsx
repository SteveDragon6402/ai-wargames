"use client";

import type {
  AttackIntention,
  DigInIntention,
  MoveIntention,
  Speed,
  Stance,
  UnitState,
} from "@wargame/shared";
import type { ActionType } from "@/lib/actions";
import { getEnemiesOnNode } from "@/lib/actions";
import {
  type OrderDraft,
  draftNeedsBreakthroughNode,
  isDraftComplete,
} from "@/lib/order-draft";
import { nodeNameMap } from "@/lib/map-display";
import type { GameState } from "@wargame/shared";
import { OptionChips } from "./OptionChips";

const ACTION_LABELS: Record<ActionType, string> = {
  move: "Move",
  dig_in: "Dig in",
  attack: "Attack",
  cover: "Cover",
  retreat: "Retreat",
  disengage: "Disengage",
};

export function CommandPanelBody({
  draft,
  unit,
  state,
  onChange,
  onCancel,
  autoSaveHint,
  groupCount = 0,
}: {
  draft: OrderDraft;
  unit: UnitState;
  state: GameState;
  onChange: (draft: OrderDraft) => void;
  onCancel?: () => void;
  autoSaveHint?: boolean;
  /** When > 1 this draft will be applied to multiple units as a group command */
  groupCount?: number;
}) {
  const names = nodeNameMap(state.map.nodes);

  const moveIntentions: MoveIntention[] =
    draft.stance === "defensive"
      ? ["reinforce", "balanced"]
      : draft.stance === "aggressive"
        ? ["assault", "attack", "reinforce", "balanced"]
        : ["attack", "reinforce", "balanced"];

  const attackIntentions: AttackIntention[] =
    draft.stance === "aggressive"
      ? ["assault", "attack", "defend", "breakthrough"]
      : ["attack", "defend"];

  const complete = isDraftComplete(draft);

  return (
    <section className="space-y-3 p-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="game-label">Order — {ACTION_LABELS[draft.action]}</p>
          <h3 className="text-sm font-semibold text-ink">{unit.name}</h3>
          {groupCount > 1 && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-contested">
              Group · {groupCount} units
            </p>
          )}
          {autoSaveHint ? (
            <p className="mt-0.5 text-xs text-mute">
              {complete
                ? "Saved to queue — adjust options anytime"
                : "Select targets on the map…"}
            </p>
          ) : null}
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-sm border border-hairline px-2 py-1 text-xs text-mute hover:bg-canvas-soft"
          >
            Close
          </button>
        ) : null}
      </header>

      {(draft.action === "move" || draft.action === "retreat") && (
        <>
          <TargetHint
            label="Destination"
            value={draft.targetNodeId ? names[draft.targetNodeId] : undefined}
            hint="Click a glowing territory on the map"
          />
          <OptionChips
            label="Speed"
            options={["slow", "normal", "forced"] as const}
            value={draft.speed}
            onChange={(speed: Speed) => onChange({ ...draft, speed })}
            optionHints={{
              slow: "Cautious march — preserves cohesion and reduces casualties",
              normal: "Standard pace — balanced risk and efficiency",
              forced: "Maximum speed — arrive sooner but fatigue and expose troops",
            }}
          />
        </>
      )}

      {draft.action === "move" && (
        <>
          <OptionChips
            label="Stance"
            options={["balanced", "aggressive", "defensive"] as const}
            value={draft.stance}
            onChange={(stance: Stance) => {
              const next = { ...draft, stance };
              if (stance === "defensive" && next.moveIntention === "attack") {
                next.moveIntention = "balanced";
              }
              if (stance !== "aggressive" && next.moveIntention === "assault") {
                next.moveIntention = "balanced";
              }
              onChange(next);
            }}
            optionHints={{
              balanced: "Even mix of offence and defence — standard approach",
              aggressive: "Press the attack on arrival — unlocks Assault intention",
              defensive: "Hold ground if engaged en route — reduces casualties",
            }}
          />
          <OptionChips
            label="Intention"
            options={moveIntentions}
            value={draft.moveIntention}
            onChange={(moveIntention: MoveIntention) =>
              onChange({ ...draft, moveIntention })
            }
            disabled={
              draft.stance === "defensive"
                ? (["assault", "attack"] as MoveIntention[])
                : draft.stance !== "aggressive"
                  ? (["assault"] as MoveIntention[])
                  : []
            }
            optionHints={{
              balanced: "Standard advance — no special posture",
              attack: "Arrive ready to fight — not available in defensive stance",
              reinforce: "Link up with friendly forces at destination",
              assault: "All-out charge — requires aggressive stance",
            }}
          />
        </>
      )}

      {draft.action === "attack" && (
        <>
          <OptionChips
            label="Stance"
            options={["balanced", "aggressive", "defensive"] as const}
            value={draft.stance}
            onChange={(stance: Stance) => {
              const next = { ...draft, stance };
              if (stance !== "aggressive" && next.attackIntention === "assault") {
                next.attackIntention = "attack";
              }
              onChange(next);
            }}
            optionHints={{
              balanced: "Even mix of offence and defence",
              aggressive: "Press hard — more damage dealt, more received; unlocks Assault and Breakthrough",
              defensive: "Fight defensively — fewer casualties but less damage output",
            }}
          />
          <OptionChips
            label="Intention"
            options={attackIntentions}
            value={draft.attackIntention}
            onChange={(attackIntention: AttackIntention) =>
              onChange({ ...draft, attackIntention, targetUnitId: undefined })
            }
            disabled={
              draft.stance !== "aggressive"
                ? (["assault", "breakthrough"] as AttackIntention[])
                : []
            }
            optionHints={{
              attack: "Standard engagement — press the battle",
              defend: "Fighting defence — hold your position while trading blows",
              assault: "All-out assault on a single target — requires aggressive stance",
              breakthrough: "Force through to an adjacent territory — requires aggressive stance",
            }}
          />
          {draft.attackIntention === "assault" && (
            <EnemyPicker
              label="Assault target"
              enemies={getEnemiesOnNode(state, unit)}
              selectedId={draft.targetUnitId}
              onSelect={(id) => onChange({ ...draft, targetUnitId: id })}
            />
          )}
          {draftNeedsBreakthroughNode(draft) && (
            <TargetHint
              label="Breakthrough to"
              value={
                draft.breakthroughTargetNodeId
                  ? names[draft.breakthroughTargetNodeId]
                  : undefined
              }
              hint="Click an adjacent territory on the map"
            />
          )}
        </>
      )}

      {draft.action === "cover" && (
        <TargetHint
          label="Covering"
          value={draft.coverUnitId ? state.units[draft.coverUnitId]?.name : undefined}
          hint="Click an ally on the map"
        />
      )}

      {draft.action === "dig_in" && (
        <OptionChips
          label="Fortify as"
          options={["hold", "deny"] as const}
          value={draft.digInIntention}
          onChange={(digInIntention: DigInIntention) =>
            onChange({ ...draft, digInIntention })
          }
          optionHints={{
            hold: "Build a strong defensive position — harder to dislodge but degrades under sustained assault",
            deny: "Block enemy movement through this node — weaker fortification but area denial",
          }}
        />
      )}

      {draft.action === "disengage" && (
        <p className="game-text">Both sides must disengage on this node to break contact.</p>
      )}

    </section>
  );
}

function TargetHint({
  label,
  value,
  hint,
}: {
  label: string;
  value?: string;
  hint: string;
}) {
  return (
    <section className="game-panel px-2 py-1.5">
      <p className="game-label">{label}</p>
      {value ? (
        <p className="mt-0.5 text-xs font-medium text-primary-soft">{value}</p>
      ) : (
        <p className="mt-0.5 text-xs italic text-mute">{hint}</p>
      )}
    </section>
  );
}

function EnemyPicker({
  label,
  enemies,
  selectedId,
  onSelect,
}: {
  label: string;
  enemies: UnitState[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (enemies.length === 0) {
    return (
      <section className="game-panel px-2 py-1.5">
        <p className="game-label">{label}</p>
        <p className="mt-0.5 text-xs italic text-mute">No enemies on this node</p>
      </section>
    );
  }

  return (
    <section className="game-panel px-2 py-1.5">
      <p className="game-label mb-1">{label}</p>
      <div className="flex flex-col gap-1">
        {enemies.map((e) => {
          const selected = e.id === selectedId;
          const str = Math.round(e.strength * 100);
          const strColor =
            str >= 70 ? "text-stat-good" : str >= 40 ? "text-stat-warn" : "text-stat-bad";
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(e.id)}
              className={`flex w-full items-center gap-2 rounded-xs px-2 py-1 text-left text-xs transition ${
                selected
                  ? "bg-faction-isengard-deep/40 ring-1 ring-faction-isengard/60 text-faction-isengard"
                  : "bg-canvas-soft hover:bg-faction-isengard-deep/20 hover:text-faction-isengard text-body"
              }`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faction-isengard" />
              <span className="flex-1 truncate">{e.name}</span>
              <span className={`shrink-0 text-xs tabular-nums font-medium ${strColor}`}>
                {str}%
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
