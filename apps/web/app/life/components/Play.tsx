"use client";

import { useRef, useState } from "react";
import { Choices } from "./Choices";
import { ChronicleView, type ChapterImage } from "./ChronicleView";
import { Portrait } from "./Portrait";
import type { Chronicle } from "../lib/chronicle";
import { chipsFor, lifeContext, questionAt } from "../lib/path";
import type { Answer, Option } from "../lib/types";

type Phase = "choices" | "portrait" | "chronicle";

type Lines = { name: string; portrait: string; want: string; hate: string; love: string };

function totalOf(answers: Answer[]): number {
  let total = 0;
  for (let index = 0; index < answers.length; index += 1) {
    const question = questionAt(index, answers.slice(0, index));
    total += question.options.find((option) => option.id === answers[index]?.optionId)?.points ?? 0;
  }
  return total;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return { error: `Server error (${response.status})` };
  }
}

export function LifePlay() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [phase, setPhase] = useState<Phase>("choices");
  const [chronicle, setChronicle] = useState<Chronicle | null>(null);
  const [lines, setLines] = useState<Lines | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Partial<Record<string, ChapterImage>>>({});
  const [imagesNote, setImagesNote] = useState<string | null>(null);
  const run = useRef(0);

  function choose(questionId: string, option: Option) {
    const next = [...answers, { questionId, optionId: option.id }];
    setAnswers(next);
    if (next.length === 7) setPhase("portrait");
  }

  function back() {
    setError(null);
    if (phase === "portrait") setPhase("choices");
    setAnswers((current) => current.slice(0, -1));
  }

  function restart() {
    run.current += 1;
    setAnswers([]);
    setPhase("choices");
    setChronicle(null);
    setLines(null);
    setBusy(false);
    setError(null);
    setImages({});
    setImagesNote(null);
  }

  async function write(portrait: Lines) {
    const token = run.current + 1;
    run.current = token;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/life/chronicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, ...portrait }),
      });
      const data = await readJson(response);
      if (token !== run.current) return;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The years were not written.");
      const written = data as unknown as Chronicle;
      setChronicle(written);
      setLines(portrait);
      setPhase("chronicle");
      if (!written.thin) void loadImages(written, token);
    } catch (err) {
      if (token !== run.current) return;
      setError(err instanceof Error ? err.message : "The years were not written.");
    } finally {
      if (token === run.current) setBusy(false);
    }
  }

  async function loadImages(written: Chronicle, token: number) {
    const loading: Partial<Record<string, ChapterImage>> = {};
    for (const chapter of written.chapters) loading[chapter.id] = { status: "loading" };
    setImages(loading);
    const results = await Promise.all(
      written.chapters.map(async (chapter) => {
        const response = await fetch("/api/life/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: chapter.imagePrompt }),
        });
        const data = await readJson(response);
        return { id: chapter.id, ok: response.ok, data };
      }),
    );
    if (token !== run.current) return;
    if (results.every((result) => result.data.skipped === true)) {
      setImages({});
      setImagesNote("Pictures are waiting on an image key.");
      return;
    }
    const next: Partial<Record<string, ChapterImage>> = {};
    for (const result of results) {
      if (result.ok && typeof result.data.image === "string") {
        next[result.id] = { status: "ready", src: result.data.image };
      } else if (result.data.skipped === true) {
        next[result.id] = { status: "error", message: "Pictures are waiting on an image key." };
      } else {
        next[result.id] = {
          status: "error",
          message: typeof result.data.error === "string" ? result.data.error : "The picture was not made.",
        };
      }
    }
    setImages(next);
  }

  if (phase === "chronicle" && chronicle && lines) {
    return <ChronicleView chronicle={chronicle} images={images} imagesNote={imagesNote} lines={lines} onRestart={restart} />;
  }

  if (phase === "portrait") {
    const context = lifeContext(answers);
    return (
      <Portrait
        choices={context.choices}
        chips={chipsFor(answers)}
        total={context.total}
        busy={busy}
        error={error}
        onBack={back}
        onWrite={write}
      />
    );
  }

  const question = questionAt(answers.length, answers);
  return (
    <Choices
      question={question}
      step={answers.length + 1}
      total={totalOf(answers)}
      onChoose={(option) => choose(question.id, option)}
      onBack={answers.length > 0 ? back : null}
    />
  );
}
