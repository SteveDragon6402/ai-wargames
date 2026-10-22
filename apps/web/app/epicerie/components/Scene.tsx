"use client";

import { useEffect, useRef, useState } from "react";
import { ITEMS, ITEM_BY_ID, itemIcon, type ShopItem } from "../data/items";
import { EXPRESSIONS, type Expression, type Line } from "../lib/shop";

const UNIT_LEFT = { left: 110, right: 830 } as const;
const BOARD_TOPS = [128, 268, 408];

/** What a sighted player sees: the thing itself, never its French name. */
export function itemLabel(item: ShopItem): string {
  return item.en;
}

interface SceneProps {
  counter: Line[];
  rungUp: boolean;
  bagCount: number;
  pointed: string | null;
  expression: Expression;
  talking: boolean;
  onPoint: (itemId: string) => void;
}

export function Scene({ counter, rungUp, bagCount, pointed, expression, talking, onPoint }: SceneProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => setScale(node.clientWidth / 1280);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={stage} className="ep-stage" role="group" aria-label="Inside Gérard's épicerie">
      <div className="ep-canvas" style={{ transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/epicerie/shop-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />

        {(["left", "right"] as const).map((unit) => (
          <div key={unit} className="ep-unit" style={{ left: UNIT_LEFT[unit] }} role="group" aria-label={`Shelves on the ${unit}`}>
            {BOARD_TOPS.map((top) => (
              <div key={top} className="ep-board" style={{ top }} />
            ))}
            {ITEMS.filter((item) => item.unit === unit).map((item) => (
              <button
                key={item.id}
                type="button"
                className="ep-item"
                data-pointed={pointed === item.id}
                style={{ left: 22 + item.slot * 106, top: BOARD_TOPS[item.shelf] - 86 }}
                aria-label={`Point at ${itemLabel(item)}`}
                aria-pressed={pointed === item.id}
                onClick={() => onPoint(item.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemIcon(item.id)} alt="" draggable={false} />
                {pointed === item.id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/epicerie/ui/pointing.png" alt="" className="ep-finger" />
                ) : null}
              </button>
            ))}
          </div>
        ))}

        <div className="ep-gerard" data-talking={talking} aria-hidden="true">
          {EXPRESSIONS.map((face) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={face}
              src={`/epicerie/gerard-${face}.webp`}
              alt=""
              draggable={false}
              style={{ opacity: face === expression ? 1 : 0 }}
            />
          ))}
        </div>

        <div className="ep-counter" />

        <div className="absolute" style={{ left: 36, top: 548 }} aria-label={`Your bag: ${bagCount} thing${bagCount === 1 ? "" : "s"} bought`} role="img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/epicerie/ui/basket.png" alt="" width={110} height={110} draggable={false} style={{ filter: "drop-shadow(0 8px 8px rgb(0 0 0 / 0.45))" }} />
          {bagCount ? (
            <span className="absolute -right-1 top-1 grid h-10 min-w-10 place-items-center rounded-full bg-[var(--ep-sage-deep)] px-2 text-[22px] font-semibold text-[var(--ep-cream)] shadow">
              {bagCount}
            </span>
          ) : null}
        </div>

        <ul className="absolute flex items-end gap-3" style={{ left: 250, top: 590, width: 720 }} aria-label="On the counter, not paid for yet">
          {counter.map((line) => {
            const item = ITEM_BY_ID[line.itemId];
            if (!item) return null;
            return (
              <li key={line.itemId} className="ep-arrive">
                <button
                  type="button"
                  className="ep-item relative"
                  style={{ position: "relative", width: 74, height: 74 }}
                  data-pointed={pointed === item.id}
                  aria-label={`Point at ${itemLabel(item)} on the counter, ${line.qty}`}
                  onClick={() => onPoint(item.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={itemIcon(item.id)} alt="" draggable={false} style={{ width: 62, height: 62 }} />
                  {line.qty > 1 ? (
                    <span className="absolute -right-2 -top-2 grid h-9 min-w-9 place-items-center rounded-full bg-[var(--ep-paper)] px-1 text-[20px] font-bold text-[var(--ep-ink)] shadow">
                      ×{line.qty}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="ep-till" style={{ top: 588 }} role="img" aria-label={rungUp ? "Gérard has rung it all up" : "Gérard's till"}>
          <div className="ep-till-body" />
          <div className="ep-till-screen" data-open={rungUp} />
        </div>
      </div>
    </div>
  );
}
