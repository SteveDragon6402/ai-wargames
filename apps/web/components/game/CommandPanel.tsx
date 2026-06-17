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
  abandon_capital: "Abandon capital",
};

export function CommandPanelBody({
  draft,
  unit,
  state,
  onChange,
  onCancel,
  autoSaveHint,
}: {
  draft: OrderDraft;
  unit: UnitState;
  state: GameState;
  onChange: (draft: OrderDraft) => void;
  onCancel?: () => void;
  autoSaveHint?: boolean;
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
          <h3 className="text-sm font-semibold text-slate-100">{unit.name}</h3>
          {autoSaveHint ? (
            <p className="mt-1 text-[10px] text-slate-500">
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
            className="shrink-0 rounded-md border border-slate-600 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
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
              assault: "Requires aggressive stance",
              attack: "Not available in defensive stance",
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
              assault: "Requires aggressive stance; pick a specific enemy target",
              breakthrough: "Requires aggressive stance; then click an adjacent territory",
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
            hold: "Stronger defense; degrades under sustained attack",
            deny: "Weaker but blocks enemy entry when dug in",
          }}
        />
      )}

      {draft.action === "disengage" && (
        <p className="game-text">Both sides must disengage on this node to break contact.</p>
      )}

      {draft.action === "abandon_capital" && (
        <p className="game-text">Relocate your capital to the fallback position. One use per game.</p>
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
        <p className="mt-0.5 text-xs font-medium text-amber-200">{value}</p>
      ) : (
        <p className="mt-0.5 text-[11px] italic text-slate-500">{hint}</p>
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
        <p className="mt-0.5 text-[11px] italic text-slate-500">No enemies on this node</p>
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
            str >= 70 ? "text-emerald-400" : str >= 40 ? "text-amber-400" : "text-red-400";
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(e.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition ${
                selected
                  ? "bg-red-900/50 ring-1 ring-red-500/60 text-red-200"
                  : "bg-slate-800/60 hover:bg-red-900/30 hover:text-red-200 text-slate-300"
              }`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              <span className="flex-1 truncate">{e.name}</span>
              <span className={`shrink-0 text-[10px] tabular-nums font-medium ${strColor}`}>
                {str}%
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
