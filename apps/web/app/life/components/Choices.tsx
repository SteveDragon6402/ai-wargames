import type { Option, Question } from "../lib/types";
import { AGE_STEPS, CHILDHOOD_STEPS, ORDINARY_LIFE, YOUTH_STEPS } from "../lib/types";

function sittingOf(step: number): string {
  if (step === 1) return "The years";
  if (step <= CHILDHOOD_STEPS) return `Childhood, ${step - 1} of ${CHILDHOOD_STEPS - 1}`;
  if (step <= YOUTH_STEPS) return `Youth, ${step - CHILDHOOD_STEPS} of ${YOUTH_STEPS - CHILDHOOD_STEPS}`;
  return `The rest, 1 of ${AGE_STEPS - YOUTH_STEPS}`;
}

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
    <main className="life-book life-book-narrow">
      <div className="flex items-start justify-between gap-4">
        <a href="/" className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4">
          All games
        </a>
        <div className="text-right">
          <div className="font-gothic text-4xl leading-none tabular-nums text-[var(--merc-text)]">{total}</div>
          <p className="mt-1 text-[13px] text-[var(--merc-muted)]">An ordinary life is {ORDINARY_LIFE}</p>
        </div>
      </div>
      <h1 className="mt-12 text-balance font-gothic text-4xl leading-[1.08] text-[var(--merc-text)] sm:text-5xl">{question.prompt}</h1>
      <p className="mt-3 text-[15px] uppercase tracking-[0.12em] text-[var(--merc-muted)]">{sittingOf(step)}</p>
      <ul className="mt-8 flex flex-col gap-3">
        {question.options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onChoose(option)}
              className="life-choice block w-full px-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className="font-gothic text-2xl text-[var(--merc-text)]">{option.label}</span>
                {option.points > 0 && (
                  <span className="shrink-0 text-[15px] tabular-nums text-[var(--merc-muted)]">{option.points}</span>
                )}
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
          className="mt-8 self-start text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
        >
          Back
        </button>
      )}
    </main>
  );
}
