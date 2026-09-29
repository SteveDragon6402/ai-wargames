"use client";

import { useState } from "react";
import { wordCount } from "../lib/path";
import { LINE_WORDS, ORDINARY_LIFE, PORTRAIT_WORDS, type ChipSet, type LifeChoice } from "../lib/types";

const field =
  "mt-2 w-full border border-[var(--merc-line)] bg-transparent px-3 py-3 text-[18px] leading-snug text-[var(--merc-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]";

function Line({
  label,
  value,
  onChange,
  chips,
  cap,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  chips?: string[];
  cap: number;
  rows?: number;
}) {
  const count = wordCount(value);
  const over = count > cap;
  return (
    <label className="block">
      <span className="font-gothic text-3xl text-[var(--merc-text)]">{label}</span>
      {rows ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={field} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} className={field} />
      )}
      <span className="mt-1 flex items-baseline justify-between gap-3">
        <span className="text-[13px]" style={{ color: over ? "var(--merc-red)" : "var(--merc-muted)" }}>
          {count} / {cap}
        </span>
      </span>
      {chips && (
        <span className="mt-2 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(chip)}
              aria-pressed={value === chip}
              className="border px-2 py-1 text-[15px] text-[var(--merc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
              style={{ borderColor: value === chip ? "var(--merc-text)" : "var(--merc-line)" }}
            >
              {chip}
            </button>
          ))}
        </span>
      )}
    </label>
  );
}

export function Portrait({
  choices,
  chips,
  total,
  busy,
  error,
  onBack,
  onWrite,
}: {
  choices: LifeChoice[];
  chips: ChipSet;
  total: number;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onWrite: (portrait: { name: string; portrait: string; want: string; hate: string; love: string }) => void;
}) {
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState("");
  const [want, setWant] = useState("");
  const [hate, setHate] = useState("");
  const [love, setLove] = useState("");
  const ready =
    wordCount(portrait) >= 1 &&
    wordCount(portrait) <= PORTRAIT_WORDS &&
    [want, hate, love].every((line) => wordCount(line) >= 1 && wordCount(line) <= LINE_WORDS);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <a href="/" className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4">
          All games
        </a>
        <div className="text-right">
          <div className="font-gothic text-4xl leading-none">{total}</div>
          <p className="mt-1 text-[13px] text-[var(--merc-muted)]">An ordinary life is {ORDINARY_LIFE}</p>
        </div>
      </div>
      <h1 className="mt-10 font-gothic text-5xl text-[var(--merc-text)]">Before the years</h1>
      <p className="mt-2 text-[17px] text-[var(--merc-muted)]">These words do not change the score.</p>
      <ol className="mt-6 flex flex-col gap-1 text-[16px] text-[var(--merc-muted)]">
        {choices.map((choice) => (
          <li key={choice.prompt}>{choice.label}</li>
        ))}
      </ol>
      <form
        className="mt-8 flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready || busy) return;
          onWrite({ name, portrait, want, hate, love });
        }}
      >
        <label className="block">
          <span className="font-gothic text-3xl">A name, if you have one</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className={field} maxLength={80} />
        </label>
        <Line label="In twenty words, what are you?" value={portrait} onChange={setPortrait} cap={PORTRAIT_WORDS} rows={3} />
        <Line label="What do you want most?" value={want} onChange={setWant} chips={chips.want} cap={LINE_WORDS} />
        <Line label="What do you hate most?" value={hate} onChange={setHate} chips={chips.hate} cap={LINE_WORDS} />
        <Line label="What do you love most?" value={love} onChange={setLove} chips={chips.love} cap={LINE_WORDS} />
        {error && <p className="text-[16px] text-[var(--merc-red)]">{error}</p>}
        <button
          type="submit"
          disabled={!ready || busy}
          className="border border-[var(--merc-text)] px-4 py-4 font-gothic text-3xl text-[var(--merc-text)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
        >
          {busy ? "The years are being written" : "Write their life"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="self-start text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4 disabled:opacity-40"
        >
          Back
        </button>
      </form>
    </main>
  );
}
