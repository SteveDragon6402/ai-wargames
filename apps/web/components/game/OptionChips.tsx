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
              className={`rounded-sm px-2 py-1 text-xs font-medium capitalize transition ${
                active
                  ? "bg-primary text-canvas ring-1 ring-primary-soft"
                  : isDisabled
                    ? "cursor-not-allowed bg-canvas-soft/40 text-hairline-dim"
                    : "bg-canvas-soft text-body hover:bg-hairline-dim"
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
