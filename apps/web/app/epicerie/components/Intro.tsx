"use client";

import { useState } from "react";
import type { DayList } from "../data/lists";
import type { Address } from "../lib/shop";

interface IntroProps {
  firstVisit: boolean;
  day: number;
  list: DayList;
  address: Address;
  onEnter: (address: Address) => void;
  onReset: () => void;
}

const ADDRESS_CHOICES: { id: Address; label: string }[] = [
  { id: "monsieur", label: "Monsieur" },
  { id: "madame", label: "Madame" },
  { id: "unknown", label: "Just bonjour" },
];

const STEPS = [
  { icon: "/epicerie/ui/pointing.png", title: "Point", text: "Tap anything on his shelves. Pointing works in any language." },
  { icon: "/epicerie/ui/talk.png", title: "Talk", text: "He only understands French. Have a go anyway." },
  { icon: "/epicerie/ui/coin.png", title: "Pay", text: "When he rings it up, count out your coins." },
];

export function Intro({ firstVisit, day, list, address, onEnter, onReset }: IntroProps) {
  const [page, setPage] = useState(firstVisit ? 0 : 2);
  const [chosen, setChosen] = useState<Address>(address);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/epicerie/shop-bg.webp" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 blur-[2px]" />
      <div className="relative w-full max-w-xl">
        <a href="/" className="mb-4 inline-flex min-h-[44px] items-center text-[14px] text-[var(--ep-cream)]/80 hover:text-[var(--ep-cream)]">
          ← The table
        </a>

        {page === 0 ? (
          <section className="ep-paper ep-arrive rounded-md px-6 py-7 sm:px-9">
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ep-ink-soft)]">Saint-Aubin-sur-Loire</p>
            <h1 className="ep-display mt-2 text-[40px] font-semibold leading-tight">L&apos;Épicerie</h1>
            <div className="mt-4 space-y-3 text-[17px] leading-relaxed">
              <p>You have rented Madame Rousseau&apos;s spare room for the week. Every morning she leaves a list on the kitchen table and a few coins beside it.</p>
              <p>The épicerie is at the end of the street. Gérard has run it for forty years. He does not speak English, and he is not going to start for you.</p>
            </div>
            <div className="mt-7 flex justify-end">
              <button type="button" className="ep-button ep-primary" onClick={() => setPage(1)}>
                Next
              </button>
            </div>
          </section>
        ) : null}

        {page === 1 ? (
          <section className="ep-paper ep-arrive rounded-md px-6 py-7 sm:px-9">
            <h2 className="ep-display text-[28px] font-semibold">How shopping works</h2>
            <ol className="mt-5 grid gap-4">
              {STEPS.map((step) => (
                <li key={step.title} className="flex items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={step.icon} alt="" width={44} height={44} className="shrink-0" />
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="text-[15px] leading-relaxed text-[var(--ep-ink-soft)]">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <fieldset className="mt-7">
              <legend className="text-[15px] font-semibold">He&apos;ll call you…</legend>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup">
                {ADDRESS_CHOICES.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen === choice.id}
                    onClick={() => setChosen(choice.id)}
                    className={`min-h-[44px] rounded-lg border text-[15px] ${chosen === choice.id ? "border-[var(--ep-sage)] bg-[var(--ep-sage)] text-[var(--ep-cream)]" : "border-[rgb(43_29_20/0.2)] bg-white/50 hover:bg-white/80"}`}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-7 flex items-center justify-between gap-3">
              <button type="button" className="ep-button ep-ink-quiet" onClick={() => setPage(0)}>
                Back
              </button>
              <button type="button" className="ep-button ep-primary" onClick={() => onEnter(chosen)}>
                Push open the door
              </button>
            </div>
          </section>
        ) : null}

        {page === 2 ? (
          <section className="ep-paper ep-arrive rounded-md px-6 py-7 sm:px-9">
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ep-ink-soft)]">Day {day + 1}</p>
            <h1 className="ep-display mt-2 text-[34px] font-semibold leading-tight">{list.title} morning</h1>
            <p className="mt-3 text-[17px] leading-relaxed">
              Madame Rousseau has left another list on the kitchen table, and a few coins beside it. Gérard will be behind his counter.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="min-h-[44px] text-[14px] text-[var(--ep-ink-soft)] underline"
                onClick={() => {
                  if (window.confirm("Start over from Monday? Gérard will forget you and your carnet will be emptied.")) onReset();
                }}
              >
                Start over
              </button>
              <button type="button" className="ep-button ep-primary" onClick={() => onEnter(address)}>
                Push open the door
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
