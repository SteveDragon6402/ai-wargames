"use client";

import type { Command, GameState } from "@wargame/shared";
import { orderLabel, orderUnitId } from "@/lib/order-label";
import { nodeNameMap } from "@/lib/map-display";

interface OrderStripProps {
  orders: Command[];
  state: GameState;
  editingUnitId: string | null;
  locked?: boolean;
  onSelect: (command: Command) => void;
  onDelete: (unitId: string) => void;
}

export function OrderStrip({
  orders,
  state,
  editingUnitId,
  locked = false,
  onSelect,
  onDelete,
}: OrderStripProps) {
  const nodeNames = nodeNameMap(state.map.nodes);

  return (
    <section className="px-3 py-2 font-mono">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mute">
          Order Queue
        </h3>
        {locked && (
          <span className="rounded-xs border border-primary-deep px-1.5 py-px text-xs font-semibold uppercase tracking-wide text-primary-soft">
            Locked
          </span>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="text-xs uppercase tracking-wide text-hairline-dim">
          No orders drafted
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {orders.map((cmd, i) => {
            const uid = orderUnitId(cmd);
            const active = uid !== null && uid === editingUnitId;

            let borderColor = "#1a1a1a";
            let bgColor = "#0d0d0d";
            if (locked) {
              borderColor = "#1a1a1a";
              bgColor = "#0a0a0a";
            } else if (active) {
              borderColor = "#10b981";
              bgColor = "rgba(0,217,146,0.08)";
            }

            return (
              <li
                key={uid ?? i}
                className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs transition"
                style={{
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  opacity: locked ? 0.7 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={locked ? undefined : () => onSelect(cmd)}
                  disabled={locked}
                  className="min-w-0 flex-1 text-left uppercase tracking-wide text-body disabled:cursor-default"
                >
                  {orderLabel(cmd, state, nodeNames)}
                </button>
                {uid && !locked && (
                  <button
                    type="button"
                    onClick={() => onDelete(uid)}
                    className="shrink-0 px-1 py-px text-xs text-mute transition-colors hover:text-faction-isengard"
                    aria-label="Remove order"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
