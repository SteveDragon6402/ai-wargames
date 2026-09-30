import { LifeChart } from "./LifeChart";
import type { Chronicle, LifeStage } from "../lib/chronicle";

export type ChapterImage = {
  status: "loading" | "ready" | "error";
  src?: string;
  message?: string;
};

function StageCharts({ stage, deathYear }: { stage: LifeStage; deathYear?: number | null }) {
  return (
    <div className="mt-8 flex flex-col gap-6">
      <LifeChart
        title={stage.fortune.label}
        caption="What they held in these years."
        deathYear={stage.died ? deathYear ?? stage.toYear : undefined}
        series={[
          {
            name: stage.fortune.label,
            points: stage.fortune.points,
            ink: "oklch(0.82 0.11 85)",
            fill: "oklch(0.78 0.11 85 / 0.28)",
          },
        ]}
      />
      <LifeChart
        title={stage.memory.label}
        caption="How spoken the name was."
        deathYear={stage.died ? deathYear ?? stage.toYear : undefined}
        series={[{ name: stage.memory.label, points: stage.memory.points, ink: "var(--merc-red)" }]}
      />
      <LifeChart
        title={stage.work.title}
        caption={stage.work.note}
        deathYear={stage.died ? deathYear ?? stage.toYear : undefined}
        series={stage.work.series.map((item, index) => ({
          name: item.name,
          points: item.points,
          ink: index === 0 ? "oklch(0.82 0.11 85)" : "oklch(0.78 0.02 85)",
        }))}
      />
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
              className="flex aspect-square w-full items-end border border-[var(--merc-line)] bg-[var(--merc-field)] p-4 text-[16px] text-[var(--merc-muted)]"
            >
              A picture of these years is being made.
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
  busy,
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
  busy: boolean;
  error: string | null;
}) {
  const latest = stages[stages.length - 1];
  if (!latest) return null;
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 py-10">
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
      {latest.dice.length > 0 && (
        <ul className="mt-8 flex flex-col gap-2 border-t border-[var(--merc-line)] pt-4 text-[16px] text-[var(--merc-muted)]">
          {latest.dice.map((roll) => (
            <li key={`${roll.die}-${roll.used}`}>
              <span className="text-[var(--merc-text)]">
                {roll.die} {roll.result}.
              </span>{" "}
              {roll.used}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-10 flex flex-col gap-16">
        {stages.map((record) => (
          <article key={record.stage.id}>
            <Pictures stageId={record.stage.id} prompts={record.stage.imagePrompts} images={images} />
            <p className="text-[14px] uppercase tracking-[0.14em] text-[var(--merc-muted)]">
              {record.stage.fromYear}–{record.stage.toYear}
            </p>
            <h2 className="mt-2 font-gothic text-4xl text-[var(--merc-text)]">{record.stage.heading}</h2>
            <p className="mt-3 max-w-xl text-[19px] leading-relaxed text-[var(--merc-text)]">{record.stage.text}</p>
            <StageCharts stage={record.stage} deathYear={record.died} />
          </article>
        ))}
      </div>
      {ended && died !== null && (
        <p className="mt-12 max-w-xl text-[18px] text-[var(--merc-muted)]">
          {latest.name} died in {died}. The name that lasted was {latest.nickname}.
        </p>
      )}
      {error && <p className="mt-8 text-[16px] text-[var(--merc-red)]">{error}</p>}
      {onContinue && (
        <button
          type="button"
          onClick={onContinue}
          disabled={busy}
          className="life-choice mt-10 border border-[var(--merc-text)] px-4 py-4 font-gothic text-3xl text-[var(--merc-text)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
        >
          {busy ? "The years are being written" : continueLabel}
        </button>
      )}
    </main>
  );
}
