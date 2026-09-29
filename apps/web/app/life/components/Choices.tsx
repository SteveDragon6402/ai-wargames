import type { Option, Question } from "../lib/types";
import { ORDINARY_LIFE, STEP_COUNT } from "../lib/types";

export function Choices({
  question,
  step,
  total,
  onChoose,
  onBack,
}: {
  question: Question;
  step: number;
  total: number;
  onChoose: (option: Option) => void;
  onBack: (() => void) | null;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <a href="/" className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4">
          All games
        </a>
        <div className="text-right">
          <div className="font-gothic text-4xl leading-none text-[var(--merc-text)]">{total}</div>
          <p className="mt-1 text-[13px] text-[var(--merc-muted)]">An ordinary life is {ORDINARY_LIFE}</p>
        </div>
      </div>
      <p className="mt-10 text-[14px] text-[var(--merc-muted)]">
        {step} of {STEP_COUNT}
      </p>
      <h1 className="mt-2 font-gothic text-4xl leading-tight text-[var(--merc-text)] sm:text-5xl">{question.prompt}</h1>
      <ul className="mt-8 flex flex-col gap-3">
        {question.options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onChoose(option)}
              className="block w-full border border-[var(--merc-line)] px-4 py-4 text-left hover:border-[var(--merc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className="font-gothic text-2xl text-[var(--merc-text)]">{option.label}</span>
                <span className="shrink-0 text-[15px] text-[var(--merc-muted)]">{option.points}</span>
              </span>
              <span className="mt-1 block text-[17px] leading-snug text-[var(--merc-muted)]">{option.detail}</span>
            </button>
          </li>
        ))}
      </ul>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-6 self-start text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
        >
          Back
        </button>
      )}
    </main>
  );
}
