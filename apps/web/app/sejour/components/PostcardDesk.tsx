"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "../lib/save";

function paint(canvas: HTMLCanvasElement, strokes: number[][]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#2b1d14";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const stroke of strokes) {
    ctx.beginPath();
    for (let i = 0; i < stroke.length; i += 2) {
      const x = (stroke[i] / 1000) * canvas.width;
      const y = (stroke[i + 1] / 1000) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function CardFace({ card }: { card: Card }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paint(ref.current, card.strokes);
  }, [card]);
  return (
    <article className="sj-card">
      <canvas ref={ref} width={280} height={160} aria-label="A sent postcard" />
      <p className="ep-hand mt-1 text-[22px]">{card.text}</p>
    </article>
  );
}

export function PostcardDesk({ cards, onSend, onDone }: { cards: Card[]; onSend: (card: { text: string; strokes: number[][] }) => void; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<number[] | null>(null);
  const strokesRef = useRef<number[][]>([]);
  const [strokes, setStrokes] = useState<number[][]>([]);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (canvas.current) paint(canvas.current, strokes);
  }, [strokes]);

  function point(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 1000);
    return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))];
  }

  return (
    <section aria-label="The postcard desk">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sejour/kitchen.jpg" alt="The kitchen desk" className="sj-photo" />
      <div className="sj-sheet">
        <h2 className="ep-display text-[28px]">A postcard</h2>
        <div className="sj-desk mt-3">
          <canvas
            ref={canvas}
            width={280}
            height={180}
            className="w-full touch-none rounded-md bg-[#f7f1e4]"
            aria-label="Scribble on the card"
            style={{ pointerEvents: sent ? "none" : "auto" }}
            onPointerDown={(event) => {
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                /* A pen that cannot be captured still draws. */
              }
              const [x, y] = point(event);
              const stroke = [x, y];
              drawing.current = stroke;
              strokesRef.current = [...strokesRef.current, stroke];
              setStrokes(strokesRef.current);
            }}
            onPointerMove={(event) => {
              if (!drawing.current) return;
              const [x, y] = point(event);
              drawing.current.push(x, y);
              setStrokes([...strokesRef.current]);
            }}
            onPointerUp={() => {
              drawing.current = null;
            }}
          />
          <label className="block">
            <span className="text-[14px]">The message</span>
            <textarea className="ep-ruled mt-1 min-h-[180px] w-full p-2" value={text} aria-label="Write the postcard" readOnly={sent} onChange={(event) => setText(event.target.value)} />
          </label>
        </div>
        {sent ? (
          <>
            <p className="mt-3 text-[15px]">Sent. It stays on the wall.</p>
            <button type="button" className="ep-button ep-primary mt-3" onClick={onDone}>
              Back to her
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ep-button ep-primary mt-3"
            onClick={() => {
              onSend({ text: text.trim(), strokes: strokesRef.current });
              setSent(true);
            }}
          >
            Send it
          </button>
        )}
        <h3 className="ep-display mt-6 text-[22px]">The wall</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {cards.length ? cards.map((card) => <CardFace key={card.id} card={card} />) : <p className="text-[15px]">Nothing sent yet.</p>}
        </div>
      </div>
    </section>
  );
}
