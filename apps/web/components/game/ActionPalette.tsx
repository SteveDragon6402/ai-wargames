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
      <p
        className="p-4 text-center text-[9px] uppercase tracking-widest"
        style={{ color: "#2a2a2a", fontFamily: "var(--font-mono), monospace" }}
      >
        No orders available
      </p>
    );
  }

  const groups = ["movement", "combat", "special"] as const;

  return (
    <section className="p-3" style={{ fontFamily: "var(--font-mono), monospace" }}>
      <h3
        className="mb-3 text-[9px] font-bold uppercase tracking-widest"
        style={{ color: "#444" }}
      >
        Draft Orders
      </h3>

      <div className="space-y-3">
        {groups.map((group) => {
          const items = ACTIONS.filter((a) => a.group === group && available.has(a.id));
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p
                className="mb-1.5 text-[8px] uppercase tracking-widest"
                style={{ color: "#333" }}
              >
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
                          className="w-full px-3 py-2 text-left transition-all"
                          style={{
                            border: `1px solid ${active ? "var(--color-gold)" : "#1a1a1a"}`,
                            background: active ? "rgba(200,148,26,0.1)" : "#0d0d0d",
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.borderColor = "#444";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.borderColor = "#1a1a1a";
                            }
                          }}
                        >
                          <span
                            className="block text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: active ? "var(--color-gold)" : "#ccc" }}
                          >
                            {a.label}
                          </span>
                          <span
                            className="mt-0.5 block text-[8px] uppercase tracking-wide"
                            style={{ color: "#444" }}
                          >
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
