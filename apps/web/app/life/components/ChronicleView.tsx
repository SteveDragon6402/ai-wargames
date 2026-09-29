import { LifeChart } from "./LifeChart";
import type { Chronicle } from "../lib/chronicle";

export type ChapterImage = {
  status: "loading" | "ready" | "error";
  src?: string;
  message?: string;
};

export function ChronicleView({
  chronicle,
  images,
  imagesNote,
  lines,
  onRestart,
}: {
  chronicle: Chronicle;
  images: Partial<Record<string, ChapterImage>>;
  imagesNote: string | null;
  lines: { portrait: string; want: string; hate: string; love: string };
  onRestart: () => void;
}) {
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
      <h1 className="mt-2 font-gothic text-5xl text-[var(--merc-text)] sm:text-6xl">{chronicle.name}</h1>
      {chronicle.thin && <p className="mt-4 text-[18px] text-[var(--merc-red)]">The years came back thin.</p>}
      {imagesNote && <p className="mt-4 text-[17px] text-[var(--merc-muted)]">{imagesNote}</p>}
      <p className="mt-6 max-w-xl text-[20px] leading-snug text-[var(--merc-text)]">{lines.portrait}</p>
      <ul className="mt-4 max-w-xl text-[17px] leading-relaxed text-[var(--merc-muted)]">
        <li>Wants {lines.want}.</li>
        <li>Hates {lines.hate}.</li>
        <li>Loves {lines.love}.</li>
      </ul>
      {chronicle.dice.length > 0 && (
        <ul className="mt-8 flex flex-col gap-2 border-t border-[var(--merc-line)] pt-4 text-[16px] text-[var(--merc-muted)]">
          {chronicle.dice.map((roll) => (
            <li key={`${roll.die}-${roll.used}`}>
              <span className="text-[var(--merc-text)]">
                {roll.die} {roll.result}.
              </span>{" "}
              {roll.used}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-10 flex flex-col gap-12">
        {chronicle.chapters.map((chapter) => {
          const image = images[chapter.id];
          return (
            <article key={chapter.id}>
              {image?.status === "ready" && image.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.src} alt="" className="mb-5 w-full border border-[var(--merc-line)]" />
              )}
              {image?.status === "loading" && (
                <div className="mb-5 flex aspect-square w-full items-end border border-[var(--merc-line)] bg-[var(--merc-field)] p-4 text-[16px] text-[var(--merc-muted)]">
                  A picture of these years is being made.
                </div>
              )}
              {image?.status === "error" && <p className="mb-4 text-[16px] text-[var(--merc-muted)]">{image.message}</p>}
              <h2 className="font-gothic text-4xl text-[var(--merc-text)]">{chapter.heading}</h2>
              <p className="mt-3 max-w-xl text-[19px] leading-relaxed text-[var(--merc-text)]">{chapter.text}</p>
            </article>
          );
        })}
      </div>
      <div className="mt-14 flex flex-col gap-6">
        <LifeChart
          title={chronicle.fortune.label}
          caption="What they held, until the year they died."
          deathYear={chronicle.died}
          series={[
            {
              name: chronicle.fortune.label,
              points: chronicle.fortune.points,
              ink: "oklch(0.82 0.11 85)",
              fill: "oklch(0.78 0.11 85 / 0.28)",
            },
          ]}
        />
        <LifeChart
          title={chronicle.memory.label}
          caption="How spoken the name was, including the years after death."
          deathYear={chronicle.died}
          series={[{ name: chronicle.memory.label, points: chronicle.memory.points, ink: "var(--merc-red)" }]}
        />
        <LifeChart
          title={chronicle.work.title}
          caption={chronicle.work.note}
          deathYear={chronicle.died}
          series={chronicle.work.series.map((item, index) => ({
            name: item.name,
            points: item.points,
            ink: index === 0 ? "oklch(0.82 0.11 85)" : "oklch(0.78 0.02 85)",
          }))}
        />
      </div>
    </main>
  );
}
