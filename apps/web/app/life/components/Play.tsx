"use client";

import { useRef, useState } from "react";
import { Choices } from "./Choices";
import { ChronicleView, type ChapterImage } from "./ChronicleView";
import { WritingWait } from "./WritingWait";
import type { Chronicle, LifeStage } from "../lib/chronicle";
import { lifeContext, questionAt } from "../lib/path";
import { AGE_STEPS, CHILDHOOD_STEPS, YOUTH_STEPS, stageForCount, type Answer, type Option, type StageId } from "../lib/types";
import { rememberWriteMs } from "../lib/wait";

type Phase = "choices" | "stage";

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

function continueLabel(ended: boolean, next: StageId | null): string {
  if (ended) return "Another life";
  if (next === "youth") return "What did they learn";
  if (next === "age") return "The rest of the life";
  return "Continue";
}

export function LifePlay() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [phase, setPhase] = useState<Phase>("choices");
  const [stages, setStages] = useState<Chronicle[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Partial<Record<string, ChapterImage>>>({});
  const [imagesNote, setImagesNote] = useState<string | null>(null);
  const run = useRef(0);

  const latest = stages[stages.length - 1];
  const ended = Boolean(latest?.ended);
  const nextSitting = ended ? null : answers.length === CHILDHOOD_STEPS ? "youth" : answers.length === YOUTH_STEPS ? "age" : null;

  function choose(questionId: string, option: Option) {
    const next = [...answers, { questionId, optionId: option.id }];
    setAnswers(next);
    const sitting = stageForCount(next.length);
    if (sitting) void write(sitting, next);
  }

  function back() {
    setError(null);
    if (phase === "stage" && !ended) {
      setPhase("choices");
      setAnswers((current) => current.slice(0, -1));
      return;
    }
    setAnswers((current) => current.slice(0, -1));
  }

  function restart() {
    run.current += 1;
    setAnswers([]);
    setPhase("choices");
    setStages([]);
    setBusy(false);
    setError(null);
    setImages({});
    setImagesNote(null);
  }

  async function write(stage: StageId, nextAnswers: Answer[]) {
    const token = run.current + 1;
    run.current = token;
    const started = Date.now();
    setBusy(true);
    setError(null);
    setPhase("stage");
    try {
      const response = await fetch("/api/life/chronicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          answers: nextAnswers,
          name: latest?.name ?? "",
          prior: stages.map((item) => item.stage),
        }),
      });
      const data = await readJson(response);
      if (token !== run.current) return;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The years were not written.");
      rememberWriteMs(stage, Date.now() - started);
      const written = data as unknown as Chronicle;
      setStages((current) => [...current, written]);
      if (!written.thin) void loadImages(written.stage, token);
    } catch (err) {
      if (token !== run.current) return;
      setError(err instanceof Error ? err.message : "The years were not written.");
      setPhase("choices");
      setAnswers((current) => current.slice(0, nextAnswers.length - 1));
    } finally {
      if (token === run.current) setBusy(false);
    }
  }

  async function loadImages(stage: LifeStage, token: number) {
    const keys = stage.imagePrompts.map((_, index) => `${stage.id}-${index}`);
    setImages((current) => {
      const next = { ...current };
      for (const key of keys) next[key] = { status: "loading" };
      return next;
    });
    const started = Date.now();
    const results = await Promise.all(
      stage.imagePrompts.map(async (prompt, index) => {
        if (!prompt) return { key: `${stage.id}-${index}`, ok: true, data: { skipped: true } as Record<string, unknown> };
        const response = await fetch("/api/life/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, frame: index === 0 ? "figure" : "place" }),
        });
        const data = await readJson(response);
        return { key: `${stage.id}-${index}`, ok: response.ok, data };
      }),
    );
    if (token !== run.current) return;
    if (results.every((result) => result.data.skipped === true)) {
      setImages((current) => {
        const next = { ...current };
        for (const key of keys) delete next[key];
        return next;
      });
      setImagesNote("Pictures are waiting on a Gemini key.");
      return;
    }
    rememberWriteMs("picture", Date.now() - started);
    setImages((current) => {
      const next = { ...current };
      for (const result of results) {
        if (result.ok && typeof result.data.image === "string") {
          next[result.key] = { status: "ready", src: result.data.image };
        } else if (result.data.skipped === true) {
          next[result.key] = { status: "error", message: "Pictures are waiting on a Gemini key." };
        } else {
          next[result.key] = {
            status: "error",
            message: typeof result.data.error === "string" ? result.data.error : "The picture was not made.",
          };
        }
      }
      return next;
    });
  }

  function goOn() {
    if (ended) {
      restart();
      return;
    }
    setPhase("choices");
  }

  if (phase === "stage" && (stages.length > 0 || busy)) {
    if (stages.length === 0) {
      return (
        <main className="life-book">
          <div className="flex items-center justify-between gap-4">
            <a href="/" className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4">
              All games
            </a>
            <p className="text-[14px] uppercase tracking-[0.14em] text-[var(--merc-muted)]">One Life</p>
            <button
              type="button"
              onClick={restart}
              className="text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
            >
              Another life
            </button>
          </div>
          <h1 className="life-name mt-12">Childhood</h1>
          <WritingWait sitting="childhood" />
        </main>
      );
    }
    return (
      <ChronicleView
        stages={stages}
        images={images}
        imagesNote={imagesNote}
        ended={ended}
        died={latest?.died ?? null}
        onRestart={restart}
        onContinue={ended || nextSitting ? goOn : null}
        continueLabel={continueLabel(ended, nextSitting)}
        writing={busy ? stageForCount(answers.length) : null}
        error={error}
      />
    );
  }

  const question = questionAt(answers.length, answers);
  const atYouth = answers.length >= CHILDHOOD_STEPS && answers.length < YOUTH_STEPS;
  const atAge = answers.length >= YOUTH_STEPS && answers.length < AGE_STEPS;
  return (
    <Choices
      question={question}
      step={answers.length + 1}
      total={totalOf(answers)}
      onChoose={(option) => choose(question.id, option)}
      onBack={answers.length > 0 || atYouth || atAge ? back : null}
    />
  );
}
