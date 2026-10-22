"use client";

import { useEffect, useMemo, useState } from "react";
import { coinLabel, formatEuros, isNote, removeCoins, sumCoins } from "../lib/shop";

function metal(cents: number): "gold" | "copper" | "bi" {
  if (cents >= 100) return "bi";
  if (cents >= 10) return "gold";
  return "copper";
}

const COIN_SIZE: Record<number, number> = { 200: 54, 100: 50, 50: 48, 20: 44, 10: 40, 5: 42, 2: 38, 1: 34 };

interface MoneyProps {
  value: number;
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
  count?: number;
}

export function Money({ value, onClick, label, disabled, count }: MoneyProps) {
  const text = coinLabel(value);
  const body = isNote(value) ? (
    <span className="ep-note h-[46px] w-[84px] text-[15px]" data-value={value}>
      {text}
    </span>
  ) : (
    <span className="ep-coin text-[13px]" data-metal={metal(value)} style={{ width: COIN_SIZE[value] ?? 44, height: COIN_SIZE[value] ?? 44 }}>
      {text}
    </span>
  );
  const badge =
    count && count > 1 ? (
      <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--ep-ink)] px-1 text-[12px] font-bold text-[var(--ep-cream)]">
        ×{count}
      </span>
    ) : null;
  if (!onClick) {
    return (
      <span className="relative inline-flex" aria-label={label ?? text}>
        {body}
        {badge}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="relative inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-40" aria-label={label ?? text}>
      {body}
      {badge}
    </button>
  );
}

export function groupCoins(coins: number[]): { value: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const coin of coins) counts.set(coin, (counts.get(coin) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([value, count]) => ({ value, count }));
}

export function Purse({ purse }: { purse: number[] }) {
  return (
    <div>
      <p className="flex items-baseline justify-between text-[14px] text-[var(--ep-cream)]/70">
        <span>Your purse</span>
        <span className="ep-display text-[20px] font-semibold tabular-nums text-[var(--ep-cream)]">{formatEuros(sumCoins(purse))}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Coins and notes in your purse">
        {groupCoins(purse).map(({ value, count }) => (
          <Money key={value} value={value} count={count} label={`${count} × ${coinLabel(value)}`} />
        ))}
      </div>
    </div>
  );
}

interface PayProps {
  till: number;
  purse: number[];
  busy: boolean;
  onHandOver: (coins: number[]) => boolean;
}

export function PaymentTray({ till, purse, busy, onHandOver }: PayProps) {
  const [offered, setOffered] = useState<number[]>([]);
  const left = useMemo(() => removeCoins(purse, offered) ?? purse, [purse, offered]);
  const paid = sumCoins(offered);

  useEffect(() => setOffered([]), [till, purse]);

  return (
    <section className="mt-4 rounded-xl bg-[var(--ep-paper-shade)]/70 p-3 sm:p-4" aria-label="Paying">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="ep-display text-[18px] text-[var(--ep-ink)]">He&apos;s waiting to be paid</h3>
        <p className="text-[13px] text-[var(--ep-ink-soft)]">Listen for the price. Tap coins to put them down.</p>
      </div>

      <div className="mt-3 flex min-h-[58px] flex-wrap items-center gap-2 rounded-lg border border-dashed border-[rgb(43_29_20/0.25)] bg-white/40 p-2" aria-label="Coins on the counter">
        {offered.length ? (
          offered.map((coin, index) => (
            <Money
              key={`${coin}-${index}`}
              value={coin}
              label={`Take back ${coinLabel(coin)}`}
              onClick={() => setOffered((current) => current.filter((_, at) => at !== index))}
            />
          ))
        ) : (
          <span className="px-1 text-[14px] italic text-[var(--ep-ink-soft)]">Nothing on the counter yet.</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Your purse">
        {groupCoins(left).map(({ value, count }) => (
          <Money key={value} value={value} count={count} label={`Put down ${coinLabel(value)}`} onClick={() => setOffered((current) => [...current, value])} disabled={busy} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-[var(--ep-ink)]">
          On the counter: <span className="font-semibold tabular-nums">{formatEuros(paid)}</span>
        </p>
        <button
          type="button"
          className="ep-button ep-primary"
          disabled={busy || !offered.length}
          onClick={() => {
            if (onHandOver(offered)) setOffered([]);
          }}
        >
          Hand it over
        </button>
      </div>
    </section>
  );
}
