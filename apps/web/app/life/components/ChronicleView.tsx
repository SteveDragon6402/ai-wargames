import { LifeChart } from "./LifeChart";
import type { Chronicle, LifeStage } from "../lib/chronicle";
import type { StageId } from "../lib/types";
import { WaitMeter, WritingWait } from "./WritingWait";

export type ChapterImage = {
  status: "loading" | "ready" | "error";
  src?: string;
  message?: string;
};

function StageCharts({ charts, deathYear }: { charts: LifeStage["charts"]; deathYear?: number | null }) {
  if (charts.length === 0) return null;
  return (
    <div className={charts.length === 2 ? "mt-10 grid items-start gap-10 lg:grid-cols-2" : "mt-10 max-w-3xl"}>
      {charts.map((chart, index) => (
        <LifeChart
          key={chart.title}
          chart={chart}
          deathYear={deathYear}
          ink={index === 0 ? "oklch(0.86 0.09 85)" : "var(--merc-red)"}
          fill={index === 0 ? "oklch(0.78 0.09 85 / 0.18)" : "oklch(0.55 0.12 27 / 0.16)"}
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
    <div className="flex flex-col gap-3">
      {prompts.map((prompt, index) => {
        const image = images[`${stageId}-${index}`];
        const frame = index === 0 ? "life-picture life-picture-figure" : "life-picture life-picture-place";
        if (image?.status === "ready" && image.src) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={image.src} alt={prompt || "A scene from the sitting."} className={frame} />
          );
        }
        if (image?.status === "loading") {
          return (
            <div key={index} className={`${frame} flex flex-col justify-end bg-[var(--merc-field)] p-4`}>
              <WaitMeter kind="picture" copy="A picture is being made." label="Making a picture" />
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

function BookBar({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <a href="/" className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4">
        All games
      </a>
      <p className="text-[14px] uppercase tracking-[0.14em] text-[var(--merc-muted)]">One Life</p>
      <button
        type="button"
        onClick={onRestart}
        className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
      >
        Another life
      </button>
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
    <main className="life-book">
      <BookBar onRestart={onRestart} />
      <h1 className="life-name mt-12 text-balance">{latest.name}</h1>
      <p className="mt-3 max-w-[36rem] text-[1.25rem] leading-snug text-[var(--merc-text)]">Known as {latest.knownAs}.</p>
      {latest.nickname !== latest.knownAs && (
        <p className="mt-1 text-[17px] text-[var(--merc-muted)]">Called {latest.nickname}.</p>
      )}
      {latest.thin && <p className="mt-4 text-[18px] text-[var(--merc-red)]">The years came back thin.</p>}
      {imagesNote && <p className="mt-4 text-[17px] text-[var(--merc-muted)]">{imagesNote}</p>}
      <div className="mt-14 flex flex-col gap-24">
        {stages.map((record) => (
          <article key={record.stage.id} className="life-sitting">
            <div className="life-sitting-spread">
              <Pictures stageId={record.stage.id} prompts={record.stage.imagePrompts} images={images} />
              <div>
                <p className="tabular-nums text-[15px] text-[var(--merc-muted)]">
                  {record.stage.fromYear}–{record.stage.toYear}
                </p>
                <h2 className="mt-2 text-balance font-gothic text-[2.35rem] leading-[1.05] text-[var(--merc-text)] sm:text-5xl">
                  {record.stage.heading}
                </h2>
                <p className="life-prose mt-5">{record.stage.text}</p>
                {record.dice.length > 0 && (
                  <ul className="mt-6 flex flex-col gap-2 border-t border-[var(--merc-line)] pt-5 text-[16px] text-[var(--merc-muted)]">
                    {record.dice.map((roll) => (
                      <li key={`${roll.question}-${roll.roll}`}>
                        <span className="text-[var(--merc-text)]">{roll.question}.</span> {roll.chance} in a hundred. {roll.roll},{" "}
                        {roll.happened ? "yes" : "no"}.
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <StageCharts
              charts={record.stage.charts}
              deathYear={record.stage.died ? record.died ?? record.stage.toYear : undefined}
            />
          </article>
        ))}
      </div>
      {ended && died !== null && (
        <p className="mt-16 max-w-[36rem] text-[18px] text-[var(--merc-muted)]">
          {latest.name} died in {died}. The name that lasted was {latest.nickname}.
        </p>
      )}
      {error && <p className="mt-8 text-[16px] text-[var(--merc-red)]">{error}</p>}
      {writing && <WritingWait sitting={writing} titled />}
      {onContinue && !writing && (
        <button
          type="button"
          onClick={onContinue}
          className="life-choice mt-12 border border-[var(--merc-text)] px-5 py-4 font-gothic text-3xl text-[var(--merc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
        >
          {continueLabel}
        </button>
      )}
    </main>
  );
}
