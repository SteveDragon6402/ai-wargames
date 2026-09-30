"use client";

import { useEffect, useRef, useState } from "react";
import { expectedWriteMs, waitRatio, type WaitKind } from "../lib/wait";
import type { StageId } from "../lib/types";

function sittingName(sitting: StageId): string {
  if (sitting === "childhood") return "Childhood";
  if (sitting === "youth") return "Youth";
  return "The rest";
}

function motionOk() {
  return window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
}

export function WaitMeter({
  kind,
  copy,
  label,
  className,
}: {
  kind: WaitKind;
  copy: string;
  label: string;
  className?: string;
}) {
  const fill = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [late, setLate] = useState(false);

  useEffect(() => {
    const horizon = expectedWriteMs(kind);
    const started = performance.now();
    let frame = 0;
    let pulse = 0;
    let shownLate = false;
    let lastPercent = -1;

    function tick(now: number) {
      const elapsed = now - started;
      const ratio = waitRatio(elapsed, horizon);
      if (fill.current) fill.current.style.transform = `scaleX(${ratio})`;
      const percent = Math.min(99, Math.round(ratio * 100));
      if (bar.current && Math.abs(percent - lastPercent) >= 5) {
        lastPercent = percent;
        bar.current.setAttribute("aria-valuenow", String(percent));
      }
      if (!shownLate && elapsed > horizon * 1.35) {
        shownLate = true;
        setLate(true);
      }
    }

    function loop(now: number) {
      tick(now);
      frame = window.requestAnimationFrame(loop);
    }

    tick(performance.now());
    if (motionOk()) {
      frame = window.requestAnimationFrame(loop);
      return () => window.cancelAnimationFrame(frame);
    }
    pulse = window.setInterval(() => tick(performance.now()), 1000);
    return () => window.clearInterval(pulse);
  }, [kind]);

  return (
    <div className={className} data-bd-inspect-label="writing-wait">
      <div
        ref={bar}
        className="life-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <span ref={fill} className="life-bar-fill" />
      </div>
      <p
        role="status"
        aria-live={kind === "picture" ? "off" : "polite"}
        aria-busy="true"
        className={`max-w-xl text-[var(--merc-muted)] ${kind === "picture" ? "mt-3 text-[16px]" : "mt-4 text-[18px]"}`}
      >
        {copy}
      </p>
      {late && kind !== "picture" && (
        <p className="mt-4 max-w-xl text-[18px] text-[var(--merc-muted)]">This is taking longer than usual.</p>
      )}
    </div>
  );
}

export function WritingWait({ sitting, titled = false }: { sitting: StageId; titled?: boolean }) {
  return (
    <div className={titled ? "relative mt-10" : "relative mt-12"}>
      {titled && (
        <p className="text-[14px] uppercase tracking-[0.14em] text-[var(--merc-muted)]">{sittingName(sitting)}</p>
      )}
      <WaitMeter kind={sitting} copy="Still writing." label="Writing the years" className="mt-6" />
    </div>
  );
}
