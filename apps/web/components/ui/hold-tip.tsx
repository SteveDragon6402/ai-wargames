"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";

/**
 * Hover-and-hold tooltip that portals to document.body.
 * Radix tooltips were clipped by overflow on the game shell and lost
 * under the map, so this positions itself in the viewport instead.
 */
export function HoldTip({
  content,
  children,
  delay = 360,
  side = "left",
  className,
  triggerClassName,
}: {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
  side?: Side;
  className?: string;
  triggerClassName?: string;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function hide() {
    clearTimer();
    setOpen(false);
    setReady(false);
  }

  function arm() {
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(true), delay);
  }

  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const trigger = wrapRef.current?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!trigger || !tip || tip.width === 0) return false;
      setCoords(place(trigger, tip, side));
      setReady(true);
      return true;
    }
    if (measure()) return;
    const id = window.requestAnimationFrame(() => {
      measure();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, side, content]);

  useLayoutEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <span
      ref={wrapRef}
      className={cn("inline-flex max-w-full", triggerClassName)}
      onPointerEnter={arm}
      onPointerLeave={hide}
      onFocus={arm}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              zIndex: 400,
              visibility: ready ? "visible" : "hidden",
              pointerEvents: "none",
            }}
            className={cn(
              "max-h-[min(360px,70vh)] max-w-[min(280px,calc(100vw-24px))] overflow-y-auto rounded-md border border-border bg-popover px-3 py-2 text-left text-[13px] font-normal leading-snug text-popover-foreground shadow-lg",
              className
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}

function place(
  trigger: DOMRect,
  tip: DOMRect,
  side: Side
): { top: number; left: number } {
  const gap = 8;
  const pad = 10;
  let top = 0;
  let left = 0;
  if (side === "left") {
    left = trigger.left - tip.width - gap;
    top = trigger.top + trigger.height / 2 - tip.height / 2;
    if (left < pad) {
      left = trigger.right + gap;
    }
  } else if (side === "right") {
    left = trigger.right + gap;
    top = trigger.top + trigger.height / 2 - tip.height / 2;
  } else if (side === "bottom") {
    left = trigger.left + trigger.width / 2 - tip.width / 2;
    top = trigger.bottom + gap;
  } else {
    left = trigger.left + trigger.width / 2 - tip.width / 2;
    top = trigger.top - tip.height - gap;
  }
  left = Math.min(
    Math.max(pad, left),
    window.innerWidth - tip.width - pad
  );
  top = Math.min(
    Math.max(pad, top),
    window.innerHeight - tip.height - pad
  );
  return { top, left };
}
