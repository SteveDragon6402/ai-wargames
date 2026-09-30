"use client";

import { useEffect, useState } from "react";
import type { StageId } from "../lib/types";

function sittingName(sitting: StageId): string {
  if (sitting === "childhood") return "Childhood";
  if (sitting === "youth") return "Youth";
  return "The rest";
}

export function WritingWait({ sitting, titled = false }: { sitting: StageId; titled?: boolean }) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setLate(true), 10_000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-bd-inspect-label="writing-wait"
      className={titled ? "relative mt-10" : "relative mt-12"}
    >
      {titled && (
        <p className="text-[14px] uppercase tracking-[0.14em] text-[var(--merc-muted)]">{sittingName(sitting)}</p>
      )}
      <svg
        className="life-wait mt-6 block"
        viewBox="0 0 48 48"
        width="56"
        height="56"
        aria-hidden="true"
      >
        <circle className="life-wait-track" cx="24" cy="24" r="18" />
        <circle className="life-wait-arc" cx="24" cy="24" r="18" pathLength="100" />
      </svg>
      <p className="life-wait-copy mt-4 max-w-xl text-[18px] text-[var(--merc-muted)]">Still writing.</p>
      {late && (
        <p className="mt-4 max-w-xl text-[18px] text-[var(--merc-muted)]">This is taking longer than usual.</p>
      )}
    </div>
  );
}
