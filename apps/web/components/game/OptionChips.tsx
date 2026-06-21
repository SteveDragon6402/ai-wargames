"use client";

import { Tooltip } from "@/components/ui/Tooltip";

interface OptionChipsProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  disabled?: readonly T[];
  optionHints?: Partial<Record<T, string>>;
}

export function OptionChips<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = [],
  optionHints = {},
}: OptionChipsProps<T>) {
  const disabledSet = new Set(disabled);
  return (
    <fieldset className="space-y-1">
      <legend className="game-label">{label}</legend>
      <section className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const isDisabled = disabledSet.has(opt);
          const active = value === opt;
          const hint = optionHints[opt];
          const btn = (
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(opt)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition ${
                active
                  ? "bg-amber-500 text-slate-950 ring-1 ring-amber-300"
                  : isDisabled
                    ? "cursor-not-allowed bg-slate-800/40 text-slate-600"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {opt.replace(/_/g, " ")}
            </button>
          );
          return hint ? (
            <Tooltip key={opt} content={hint}>
              {btn}
            </Tooltip>
          ) : (
            <span key={opt}>{btn}</span>
          );
        })}
      </section>
    </fieldset>
  );
}
