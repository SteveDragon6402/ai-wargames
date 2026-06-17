"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      x: rect.left + rect.width / 2,
      y: side === "top" ? rect.top : rect.bottom,
    });
  }, [side]);

  const hide = useCallback(() => setCoords(null), []);

  const tooltipStyle: React.CSSProperties = coords
    ? {
        position: "fixed",
        left: coords.x,
        top: side === "top" ? coords.y - 6 : coords.y + 6,
        transform: side === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        zIndex: 99999,
        pointerEvents: "none",
      }
    : {};

  return (
    <span
      ref={triggerRef}
      className="inline-flex max-w-full"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {coords &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={tooltipStyle}
            className="w-max max-w-[260px] rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] leading-snug text-slate-200 shadow-xl"
          >
            {content}
          </span>,
          document.body
        )}
    </span>
  );
}
