"use client";

import type { Command, GameState } from "@wargame/shared";
import { orderLabel, orderUnitId } from "@/lib/order-label";
import { nodeNameMap } from "@/lib/map-display";

interface OrderStripProps {
  orders: Command[];
  state: GameState;
  editingUnitId: string | null;
  onSelect: (command: Command) => void;
  onDelete: (unitId: string) => void;
}

export function OrderStrip({
  orders,
  state,
  editingUnitId,
  onSelect,
  onDelete,
}: OrderStripProps) {
  const nodeNames = nodeNameMap(state.map.nodes);

  return (
    <section className="px-3 py-2">
      <h3 className="game-label mb-1.5">Order queue</h3>
      {orders.length === 0 ? (
        <p className="text-[11px] text-slate-600">
          Issue commands from the panel — they appear here for review and edits.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-1 p-0">
          {orders.map((cmd, i) => {
            const uid = orderUnitId(cmd);
            const active = uid !== null && uid === editingUnitId;
            return (
              <li
                key={uid ?? i}
                className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-[11px] transition ${
                  active
                    ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30"
                    : "border-slate-700/80 bg-slate-950 hover:border-slate-600 hover:bg-slate-900"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(cmd)}
                  className="min-w-0 flex-1 text-left text-slate-200"
                >
                  {orderLabel(cmd, state, nodeNames)}
                </button>
                {uid ? (
                  <button
                    type="button"
                    onClick={() => onDelete(uid)}
                    className="shrink-0 rounded px-1.5 py-px text-[10px] text-red-400 hover:bg-red-500/10"
                    aria-label="Remove order"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
