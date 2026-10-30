"use client";

import { useState } from "react";
import { looksFrench } from "@/app/epicerie/lib/french";
import { FIRST_PAGE, type Phrase, type Save } from "../lib/save";
import { hear } from "../lib/voice";

interface PhrasebookProps {
  save: Save;
  onClose: () => void;
  onAdd: (fr: string, en: string, pageId?: string) => void;
  onPage: (title: string) => void;
  onMove: (phraseId: string, pageId: string) => void;
  onJournal: (text: string) => void;
}

export function Phrasebook({ save, onClose, onAdd, onPage, onMove, onJournal }: PhrasebookProps) {
  const pages = save.pages.length ? save.pages : [FIRST_PAGE];
  const [pageIndex, setPageIndex] = useState(0);
  const [fr, setFr] = useState("");
  const [en, setEn] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const safeIndex = Math.min(pageIndex, pages.length - 1);
  const page = pages[safeIndex];
  const shown = save.phrases.filter((phrase) => phrase.pageId === page.id);
  const others = pages.filter((item) => item.id !== page.id);

  async function play(phrase: Phrase) {
    setError(await hear("rousseau", phrase.fr));
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/75 p-4" role="dialog" aria-label="Phrasebook">
      <div className="sj-sheet flex max-h-[85dvh] w-full max-w-lg flex-col rounded-xl p-4 pb-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="ep-display text-[28px]">Phrasebook</h2>
          <button type="button" className="text-[15px] underline" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" className="ep-button" disabled={safeIndex <= 0} onClick={() => setPageIndex((index) => Math.max(0, index - 1))}>
            Previous
          </button>
          <p className="min-w-0 flex-1 text-center">
            <span className="block text-[20px] font-semibold leading-tight">{page.title}</span>
            <span className="text-[14px] text-[var(--ep-ink-soft)]">
              {safeIndex + 1} of {pages.length}
            </span>
          </p>
          <button type="button" className="ep-button" disabled={safeIndex >= pages.length - 1} onClick={() => setPageIndex((index) => Math.min(pages.length - 1, index + 1))}>
            Next
          </button>
        </div>
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            onPage(title);
            setTitle("");
            setPageIndex(pages.length);
          }}
        >
          <input
            className="min-h-[44px] min-w-[12rem] flex-1 rounded-md border border-[rgb(43_29_20/0.28)] bg-white px-2"
            value={title}
            placeholder="New page name"
            aria-label="New page name"
            onChange={(event) => setTitle(event.target.value)}
          />
          <button type="submit" className="ep-button">
            Add a page
          </button>
        </form>
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto">
          {shown.length ? (
            shown.map((phrase) => (
              <li key={phrase.id} className="rounded-lg bg-white/50 p-2">
                <p className="text-[20px] leading-snug">{phrase.fr}</p>
                {phrase.en ? <p className="text-[16px]">{phrase.en}</p> : null}
                <p className="text-[12px] text-[var(--ep-ink-soft)]">{phrase.source}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" className="ep-button" onClick={() => void play(phrase)}>
                    Hear it
                  </button>
                  {others.length ? (
                    <select
                      className="min-h-[44px] min-w-[10rem] rounded-md border border-[rgb(43_29_20/0.28)] bg-white px-2"
                      value=""
                      aria-label={`Move ${phrase.fr}`}
                      onChange={(event) => {
                        if (event.target.value) onMove(phrase.id, event.target.value);
                      }}
                    >
                      <option value="">Another page</option>
                      {others.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </li>
            ))
          ) : (
            <li className="text-[15px] text-[var(--ep-ink-soft)]">Nothing on this page yet.</li>
          )}
          <li>
            <label className="mt-2 block text-[14px]">
              Your notes
              <textarea
                className="mt-1 min-h-[72px] w-full resize-none rounded-md border border-[rgb(43_29_20/0.28)] bg-white p-2"
                value={save.journal}
                onChange={(event) => onJournal(event.target.value)}
              />
            </label>
          </li>
        </ul>
        {error ? <p className="sj-error">{error}</p> : null}
        <form
          className="mt-3 grid gap-2 border-t border-[rgb(43_29_20/0.15)] pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!looksFrench(fr)) {
              setError("That's not French.");
              return;
            }
            setError(null);
            onAdd(fr, en, page.id);
            setFr("");
            setEn("");
          }}
        >
          <p className="text-[14px] font-semibold">Add a phrase to this page</p>
          <input
            className="min-h-[44px] rounded-md border border-[rgb(43_29_20/0.28)] bg-white px-2"
            value={fr}
            placeholder="French"
            aria-label="French"
            onChange={(event) => setFr(event.target.value)}
          />
          <input
            className="min-h-[44px] rounded-md border border-[rgb(43_29_20/0.28)] bg-white px-2"
            value={en}
            placeholder="English"
            aria-label="English"
            onChange={(event) => setEn(event.target.value)}
          />
          <button type="submit" className="ep-button ep-primary w-fit">
            Add the phrase
          </button>
        </form>
      </div>
    </div>
  );
}
