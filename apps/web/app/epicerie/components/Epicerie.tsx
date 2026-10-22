"use client";

import { useEffect, useState } from "react";
import { DoorOpen, ScrollText, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ITEMS, itemIcon } from "../data/items";
import { useEpicerie } from "../hooks/useEpicerie";
import { listComplete, listForDay, type Turn } from "../lib/shop";
import { canSpeak, speakFrench } from "../lib/voice";
import { Composer } from "./Composer";
import { Debrief } from "./Debrief";
import { Dialogue, YouSaid } from "./Dialogue";
import { Intro } from "./Intro";
import { PaymentTray, Purse } from "./Money";
import { GroceryList } from "./Notebook";
import { Scene, itemLabel } from "./Scene";

const SHELF_GROUPS = [
  { unit: "left", shelf: 0, label: "Left shelves, top" },
  { unit: "left", shelf: 1, label: "Left shelves, middle" },
  { unit: "left", shelf: 2, label: "Left shelves, bottom" },
  { unit: "right", shelf: 0, label: "Right shelves, top" },
  { unit: "right", shelf: 1, label: "Right shelves, middle" },
  { unit: "right", shelf: 2, label: "Right shelves, bottom" },
] as const;

function lastOf(transcript: Turn[], role: Turn["role"]): { turn: Turn | null; index: number } {
  for (let index = transcript.length - 1; index >= 0; index -= 1) if (transcript[index].role === role) return { turn: transcript[index], index };
  return { turn: null, index: -1 };
}

export function Epicerie() {
  const game = useEpicerie();
  const { save, session, list, phase, busy } = game;
  const [pointed, setPointed] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [shelvesOpen, setShelvesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);

  useEffect(() => setVoiceAvailable(canSpeak()), []);

  if (phase === "loading" || !save) {
    return <main className="grid min-h-dvh place-items-center text-[var(--ep-cream)]/70">Opening the shop…</main>;
  }

  if (phase === "intro") {
    return <Intro key={save.visits === 0 ? "first" : "back"} firstVisit={save.visits === 0} day={save.day} list={list} address={save.address} onEnter={game.enter} onReset={game.resetAll} />;
  }

  if (phase === "debrief" && game.visit) {
    return <Debrief visit={game.visit} list={listForDay(game.visit.day)} onNext={game.toNextDay} />;
  }

  if (!session) return null;

  const transcript = session.transcript;
  const gerard = lastOf(transcript, "gerard");
  const before = transcript.length && transcript[transcript.length - 1].role !== "gerard" ? transcript[transcript.length - 1] : gerard.index > 0 ? transcript[gerard.index - 1] : null;
  const expression = gerard.turn?.expression ?? "neutral";
  const complete = listComplete(list, session.basket);
  const leaving = phase === "leaving";
  const bagCount = session.basket.reduce((total, line) => total + line.qty, 0);

  function point(itemId: string) {
    setPointed((current) => (current === itemId ? null : itemId));
    if (window.matchMedia("(pointer: fine)").matches) document.getElementById("ep-say")?.focus();
  }

  return (
    <div className="mx-auto max-w-[1440px] px-3 pb-10 pt-3 sm:px-5">
      <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href="/" className="inline-flex min-h-[44px] items-center text-[14px] text-[var(--ep-cream)]/75 hover:text-[var(--ep-cream)]">
          ← The table
        </a>
        <h1 className="ep-display text-[22px] font-semibold text-[var(--ep-cream)]">
          L&apos;Épicerie <span className="text-[15px] font-normal text-[var(--ep-cream)]/70">· Day {session.day + 1}, {list.title}</span>
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {voiceAvailable ? (
            <button
              type="button"
              className="ep-button ep-icon ep-quiet"
              onClick={() => game.setVoice(!save.voice)}
              aria-pressed={save.voice}
              aria-label={save.voice ? "Gérard's voice is on. Turn it off." : "Gérard's voice is off. Turn it on."}
              title={save.voice ? "Voice on" : "Voice off"}
            >
              {save.voice ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
            </button>
          ) : null}
          <button type="button" className="ep-button ep-quiet" onClick={() => setLogOpen(true)}>
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            <span>Log</span>
          </button>
          <button
            type="button"
            className={`ep-button ${complete ? "ep-primary" : "ep-quiet"}`}
            disabled={busy || leaving}
            onClick={() => {
              if (!complete && !window.confirm("Leave the shop? Anything not paid for stays on the counter.")) return;
              setPointed(null);
              game.leave();
            }}
          >
            <DoorOpen className="h-4 w-4" aria-hidden="true" />
            <span>Leave the shop</span>
          </button>
        </div>
      </header>

      {complete && !leaving ? (
        <p role="status" className="ep-arrive mb-3 rounded-lg bg-[var(--ep-sage)]/25 px-4 py-2 text-[15px] text-[var(--ep-cream)]">
          Everything is in your bag. Leave when you&apos;re ready.
        </p>
      ) : null}

      <main className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Scene
            counter={session.counter}
            rungUp={session.till !== null}
            bagCount={bagCount}
            pointed={pointed}
            expression={expression}
            talking={busy}
            onPoint={point}
          />
          <div className="relative z-10 mt-5 lg:-mt-6 lg:px-6">
            <Dialogue
              gerard={gerard.turn}
              before={before}
              busy={busy}
              problem={game.problem}
              canReplay={voiceAvailable}
              onReplay={() => gerard.turn && speakFrench(gerard.turn.text)}
              onDismiss={game.dismissProblem}
            >
              {session.till !== null && !leaving ? <PaymentTray till={session.till} purse={session.purse} busy={busy} onHandOver={game.handOver} /> : null}
              {leaving ? (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-[rgb(43_29_20/0.12)] pt-3">
                  <button type="button" className="ep-button ep-ink-quiet" disabled={busy} onClick={game.stay}>
                    Wait, one more thing
                  </button>
                  <button type="button" className="ep-button ep-primary" disabled={busy || Boolean(game.problem)} onClick={game.finish}>
                    Step outside
                  </button>
                </div>
              ) : (
                <Composer
                  pointed={pointed}
                  busy={busy}
                  disabled={leaving}
                  text={text}
                  onText={setText}
                  onClearPoint={() => setPointed(null)}
                  onOpenShelves={() => setShelvesOpen(true)}
                  onSend={(said, gesture) => {
                    game.say(said, pointed, gesture);
                    setPointed(null);
                  }}
                />
              )}
            </Dialogue>
          </div>
        </div>

        <aside className="grid content-start gap-5 pt-2 lg:sticky lg:top-4 lg:self-start" aria-label="Your things">
          <GroceryList list={list} basket={session.basket} />
          <section className="ep-purse rounded-xl p-4" aria-label="Your purse">
            <Purse purse={session.purse} />
          </section>
        </aside>
      </main>

      <Dialog open={shelvesOpen} onOpenChange={setShelvesOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto border-[rgb(43_29_20/0.15)] bg-[var(--ep-paper)] text-[var(--ep-ink)]">
          <DialogTitle className="ep-display text-[22px]">Point at something</DialogTitle>
          <DialogDescription className="text-[var(--ep-ink-soft)]">Tap a thing on Gérard&apos;s shelves.</DialogDescription>
          <div className="grid gap-3">
            {SHELF_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-[13px] text-[var(--ep-ink-soft)]">{group.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {ITEMS.filter((item) => item.unit === group.unit && item.shelf === group.shelf).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="grid aspect-square place-items-center rounded-lg bg-white/60 hover:bg-white"
                      aria-label={`Point at ${itemLabel(item)}`}
                      onClick={() => {
                        setPointed(item.id);
                        setShelvesOpen(false);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={itemIcon(item.id)} alt="" width={56} height={56} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto border-[rgb(43_29_20/0.15)] bg-[var(--ep-paper)] text-[var(--ep-ink)]">
          <DialogTitle className="ep-display text-[22px]">Today in the shop</DialogTitle>
          <DialogDescription className="text-[var(--ep-ink-soft)]">Everything said so far, oldest first.</DialogDescription>
          <ol className="grid gap-2.5">
            {transcript.map((turn, index) => (
              <li key={index} className="text-[15px] leading-relaxed">
                {turn.role === "gerard" ? (
                  <>
                    <span className="font-semibold">Gérard: </span>
                    <span lang="fr">{turn.text}</span>
                    {turn.action ? <span className="block text-[13px] italic text-[var(--ep-ink-soft)]">{turn.action}</span> : null}
                  </>
                ) : turn.role === "you" ? (
                  <YouSaid turn={turn} />
                ) : (
                  <em className="text-[var(--ep-ink-soft)]">{turn.text}</em>
                )}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
