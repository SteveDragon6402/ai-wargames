"use client";

import type { ActionType } from "@/lib/actions";
import { Tooltip } from "@/components/ui/Tooltip";

const ACTIONS: {
  id: ActionType;
  label: string;
  desc: string;
  group: "movement" | "combat" | "special";
}[] = [
  { id: "move", label: "Move", desc: "March to an adjacent territory", group: "movement" },
  { id: "retreat", label: "Retreat", desc: "Withdraw along your entry route", group: "movement" },
  { id: "attack", label: "Attack", desc: "Fight an enemy on this node", group: "combat" },
  { id: "cover", label: "Cover", desc: "Shield an ally who is retreating", group: "combat" },
  { id: "dig_in", label: "Dig in", desc: "Fortify — hold ground or deny entry", group: "combat" },
  { id: "disengage", label: "Disengage", desc: "Break contact if both sides agree", group: "combat" },
  {
    id: "abandon_capital",
    label: "Abandon capital",
    desc: "Relocate capital to fallback position (once per game)",
    group: "special",
  },
];

interface ActionPaletteProps {
  actions: ActionType[];
  activeAction: ActionType | null;
  onPick: (action: ActionType) => void;
}

export function ActionPalette({ actions, activeAction, onPick }: ActionPaletteProps) {
  const available = new Set(actions);
  if (actions.length === 0) {
    return (
      <p className="p-4 text-center text-[11px] text-slate-600">No actions for this unit</p>
    );
  }

  const groups = ["movement", "combat", "special"] as const;

  return (
    <section className="p-3">
      <h3 className="game-label mb-2">Commands</h3>
      <section className="space-y-3">
        {groups.map((group) => {
          const items = ACTIONS.filter((a) => a.group === group && available.has(a.id));
          if (items.length === 0) return null;
          return (
            <section key={group}>
              <p className="mb-1 text-[9px] capitalize text-slate-600">{group}</p>
              <ul className="grid list-none gap-1.5 p-0">
                {items.map((a) => (
                  <li key={a.id}>
                    <Tooltip content={a.desc}>
                      <button
                        type="button"
                        onClick={() => onPick(a.id)}
                        className={`w-full rounded-md border px-2.5 py-2 text-left transition ${
                          activeAction === a.id
                            ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40"
                            : "border-slate-700 bg-slate-900/80 hover:border-amber-600/50 hover:bg-slate-800"
                        }`}
                      >
                        <span className="block text-xs font-medium text-slate-100">
                          {a.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-slate-500 line-clamp-1">
                          {a.desc}
                        </span>
                      </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </section>
    </section>
  );
}
