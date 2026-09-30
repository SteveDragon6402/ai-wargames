import { LifeChart } from "./LifeChart";
import type { Chronicle, LifeStage } from "../lib/chronicle";
import type { StageId } from "../lib/types";
import { WritingWait } from "./WritingWait";

export type ChapterImage = {
  status: "loading" | "ready" | "error";
  src?: string;
  message?: string;
};

function StageCharts({ charts, deathYear }: { charts: LifeStage["charts"]; deathYear?: number | null }) {
  if (charts.length === 0) return null;
  return (
    <div className={charts.length === 2 ? "mt-8 grid items-start gap-4 lg:grid-cols-2" : "mt-8 max-w-3xl"}>
      {charts.map((chart, index) => (
        <LifeChart
          key={chart.title}
          chart={chart}
          deathYear={deathYear}
          ink={index === 0 ? "oklch(0.82 0.11 85)" : "var(--merc-red)"}
          fill={index === 0 ? "oklch(0.78 0.11 85 / 0.28)" : undefined}
        />
      ))}
    </div>
  );
}

function Pictures({
  stageId,
  prompts,
  images,
}: {
  stageId: string;
  prompts: string[];
  images: Partial<Record<string, ChapterImage>>;
}) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {prompts.map((_, index) => {
        const image = images[`${stageId}-${index}`];
        if (image?.status === "ready" && image.src) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={image.src} alt="" className="w-full border border-[var(--merc-line)]" />
          );
        }
        if (image?.status === "loading") {
          return (
            <div
              key={index}
              role="status"
              aria-live="polite"
              className="relative flex aspect-square w-full flex-col items-center justify-center border border-[var(--merc-line)] bg-[var(--merc-field)]"
            >
              <svg className="life-wait block" viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
                <circle className="life-wait-track" cx="24" cy="24" r="18" />
                <circle className="life-wait-arc" cx="24" cy="24" r="18" pathLength="100" />
              </svg>
              <span className="life-wait-copy mt-3 text-[16px] text-[var(--merc-muted)]">A picture is being made.</span>
            </div>
          );
        }
        if (image?.status === "error") {
          return (
            <p key={index} className="text-[16px] text-[var(--merc-muted)]">
              {image.message}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

export function ChronicleView({
  stages,
  images,
  imagesNote,
  ended,
  died,
  onRestart,
  onContinue,
  continueLabel,
  writing,
  error,
}: {
  stages: Chronicle[];
  images: Partial<Record<string, ChapterImage>>;
  imagesNote: string | null;
  ended: boolean;
  died: number | null;
  onRestart: () => void;
  onContinue: (() => void) | null;
  continueLabel: string;
  writing: StageId | null;
  error: string | null;
}) {
  const latest = stages[stages.length - 1];
  if (!latest) return null;
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <a href="/" className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4">
          All games
        </a>
        <button
          type="button"
          onClick={onRestart}
          className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
        >
          Another life
        </button>
      </div>
      <p className="mt-10 text-[14px] uppercase tracking-[0.14em] text-[var(--merc-muted)]">One Life</p>
      <h1 className="mt-2 font-gothic text-5xl text-[var(--merc-text)] sm:text-6xl">{latest.name}</h1>
      <p className="mt-3 max-w-xl text-[20px] leading-snug text-[var(--merc-text)]">Known as {latest.knownAs}.</p>
      {latest.nickname !== latest.knownAs && (
        <p className="mt-1 text-[17px] text-[var(--merc-muted)]">Called {latest.nickname}.</p>
      )}
      {latest.thin && <p className="mt-4 text-[18px] text-[var(--merc-red)]">The years came back thin.</p>}
      {imagesNote && <p className="mt-4 text-[17px] text-[var(--merc-muted)]">{imagesNote}</p>}
      <div className="mt-10 flex flex-col gap-16">
        {stages.map((record) => (
          <article key={record.stage.id}>
            <p className="text-[14px] uppercase tracking-[0.14em] text-[var(--merc-muted)]">
              {record.stage.fromYear}–{record.stage.toYear}
            </p>
            <h2 className="mt-2 font-gothic text-4xl text-[var(--merc-text)]">{record.stage.heading}</h2>
            <p className="mt-3 max-w-2xl text-[19px] leading-relaxed text-[var(--merc-text)]">{record.stage.text}</p>
            {record.dice.length > 0 && (
              <ul className="mt-5 flex flex-col gap-1 text-[16px] text-[var(--merc-muted)]">
                {record.dice.map((roll) => (
                  <li key={`${roll.question}-${roll.roll}`}>
                    <span className="text-[var(--merc-text)]">{roll.question}.</span> {roll.chance} in a hundred. {roll.roll},{" "}
                    {roll.happened ? "yes" : "no"}.
                  </li>
                ))}
              </ul>
            )}
            <StageCharts
              charts={record.stage.charts}
              deathYear={record.stage.died ? record.died ?? record.stage.toYear : undefined}
            />
            <div className="mt-8">
              <Pictures stageId={record.stage.id} prompts={record.stage.imagePrompts} images={images} />
            </div>
          </article>
        ))}
      </div>
      {ended && died !== null && (
        <p className="mt-12 max-w-xl text-[18px] text-[var(--merc-muted)]">
          {latest.name} died in {died}. The name that lasted was {latest.nickname}.
        </p>
      )}
      {error && <p className="mt-8 text-[16px] text-[var(--merc-red)]">{error}</p>}
      {writing && <WritingWait sitting={writing} titled />}
      {onContinue && !writing && (
        <button
          type="button"
          onClick={onContinue}
          className="life-choice mt-10 border border-[var(--merc-text)] px-4 py-4 font-gothic text-3xl text-[var(--merc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
        >
          {continueLabel}
        </button>
      )}
    </main>
  );
}
