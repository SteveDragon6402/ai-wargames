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
  { id: "dig_in", label: "Dig In", desc: "Fortify — hold ground or deny entry", group: "combat" },
  { id: "disengage", label: "Disengage", desc: "Break contact if both sides agree", group: "combat" },
];

const GROUP_LABEL: Record<string, string> = {
  movement: "// Movement",
  combat: "// Combat",
  special: "// Special",
};

interface ActionPaletteProps {
  actions: ActionType[];
  activeAction: ActionType | null;
  onPick: (action: ActionType) => void;
}

export function ActionPalette({ actions, activeAction, onPick }: ActionPaletteProps) {
  const available = new Set(actions);

  if (actions.length === 0) {
    return (
      <p className="p-4 text-center text-xs uppercase tracking-wide text-hairline-dim font-mono">
        No orders available
      </p>
    );
  }

  const groups = ["movement", "combat", "special"] as const;

  return (
    <section className="p-3 font-mono">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-mute">
        Draft Orders
      </h3>

      <div className="space-y-3">
        {groups.map((group) => {
          const items = ACTIONS.filter((a) => a.group === group && available.has(a.id));
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-hairline-dim">
                {GROUP_LABEL[group]}
              </p>
              <ul className="flex flex-col gap-1">
                {items.map((a) => {
                  const active = activeAction === a.id;
                  return (
                    <li key={a.id}>
                      <Tooltip content={a.desc}>
                        <button
                          type="button"
                          onClick={() => onPick(a.id)}
                          className={`w-full rounded-xs px-3 py-2 text-left transition-all ${
                            active
                              ? "border border-primary bg-primary/10"
                              : "border border-hairline-dim bg-canvas-soft hover:border-hairline"
                          }`}
                        >
                          <span
                            className={`block text-xs font-semibold uppercase tracking-wide ${
                              active ? "text-primary-soft" : "text-body"
                            }`}
                          >
                            {a.label}
                          </span>
                          <span className="mt-0.5 block text-xs uppercase tracking-wide text-mute">
                            {a.desc}
                          </span>
                        </button>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
