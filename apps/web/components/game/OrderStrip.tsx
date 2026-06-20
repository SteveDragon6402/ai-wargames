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
    <section
      className="px-3 py-2"
      style={{ fontFamily: "var(--font-mono), monospace" }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <h3
          className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: "#444" }}
        >
          Order Queue
        </h3>
        {locked && (
          <span
            className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-px"
            style={{ color: "var(--color-gold)", border: "1px solid #8b6914" }}
          >
            Locked
          </span>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="text-[9px] uppercase tracking-wide" style={{ color: "#2a2a2a" }}>
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
              borderColor = "#8b6914";
              bgColor = "rgba(200,148,26,0.08)";
            }

            return (
              <li
                key={uid ?? i}
                className="flex items-center justify-between gap-2 px-2 py-1.5 text-[9px] transition"
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
                  className="min-w-0 flex-1 text-left disabled:cursor-default uppercase tracking-wide"
                  style={{ color: "#999" }}
                >
                  {orderLabel(cmd, state, nodeNames)}
                </button>
                {uid && !locked && (
                  <button
                    type="button"
                    onClick={() => onDelete(uid)}
                    className="shrink-0 px-1 py-px text-[10px] transition-colors"
                    style={{ color: "#444" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#e05555")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
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
