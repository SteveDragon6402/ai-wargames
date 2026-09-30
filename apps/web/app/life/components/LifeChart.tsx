"use client";

import { useId, useState } from "react";
import type { YearPoint } from "../lib/chronicle";

type Series = {
  name: string;
  points: YearPoint[];
  ink: string;
  fill?: string;
};

type Hover = { x: number; y: number; year: number; value: number; name: string };

function yearLabel(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`;
  return String(year);
}

export function LifeChart({
  title,
  caption,
  series,
  deathYear,
}: {
  title: string;
  caption: string;
  series: Series[];
  deathYear?: number | null;
}) {
  const drawn = series.map((item) => ({
    ...item,
    points: [...item.points].sort((a, b) => a.year - b.year),
  }));
  const width = 640;
  const height = 250;
  const pad = { l: 36, r: 16, t: 16, b: 32 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const years = drawn.flatMap((item) => item.points.map((point) => point.year));
  const values = drawn.flatMap((item) => item.points.map((point) => point.value));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const maxValue = Math.max(10, ...values);
  const xOf = (year: number) => (maxYear === minYear ? pad.l + innerW / 2 : pad.l + ((year - minYear) / (maxYear - minYear)) * innerW);
  const yOf = (value: number) => pad.t + innerH - (Math.max(0, value) / maxValue) * innerH;
  const ticks = [0, 1, 2, 3].map((step) => Math.round(minYear + ((maxYear - minYear) * step) / 3));
  const base = pad.t + innerH;
  const [hover, setHover] = useState<Hover | null>(null);
  const tipId = useId();

  function line(points: YearPoint[]) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"}${xOf(point.year).toFixed(1)} ${yOf(point.value).toFixed(1)}`)
      .join(" ");
  }

  return (
    <figure className="relative border border-[var(--merc-line)] bg-[var(--merc-field)] px-4 py-4">
      <figcaption>
        <div className="font-gothic text-3xl text-[var(--merc-text)]">{title}</div>
        <p className="mt-1 text-[16px] leading-snug text-[var(--merc-muted)]">{caption}</p>
        {drawn.length > 1 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-[var(--merc-muted)]">
            {drawn.map((item) => (
              <li key={item.name} className="flex items-center gap-2">
                <span className="inline-block h-px w-6" style={{ background: item.ink }} />
                {item.name}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        aria-describedby={hover ? tipId : undefined}
        className="mt-2 w-full"
        onMouseLeave={() => setHover(null)}
      >
        <line x1={pad.l} y1={base} x2={width - pad.r} y2={base} stroke="var(--merc-line)" />
        {ticks.map((year) => (
          <text key={year} x={xOf(year)} y={height - 8} textAnchor="middle" fill="var(--merc-muted)" fontSize="12">
            {yearLabel(year)}
          </text>
        ))}
        {deathYear !== undefined && deathYear !== null && deathYear >= minYear && deathYear <= maxYear && (
          <g>
            <line x1={xOf(deathYear)} y1={pad.t} x2={xOf(deathYear)} y2={base} stroke="var(--merc-red)" strokeDasharray="3 4" />
            <text x={xOf(deathYear) + 6} y={pad.t + 12} fill="var(--merc-red)" fontSize="12">
              died
            </text>
          </g>
        )}
        {drawn.map((item) => (
          <g key={item.name}>
            {item.fill && item.points.length > 1 && (
              <path
                className="life-fill"
                d={`${line(item.points)} L${xOf(item.points[item.points.length - 1].year).toFixed(1)} ${base} L${xOf(item.points[0].year).toFixed(1)} ${base} Z`}
                fill={item.fill}
              />
            )}
            <path className="life-stroke" d={line(item.points)} fill="none" stroke={item.ink} strokeWidth="2.25" pathLength={1} />
            {item.points.map((point) => (
              <circle
                key={`${item.name}-${point.year}`}
                className="life-point"
                cx={xOf(point.year)}
                cy={yOf(point.value)}
                r={hover?.year === point.year && hover.name === item.name ? 6 : 4}
                fill="var(--merc-bg)"
                stroke={item.ink}
                strokeWidth="2"
                tabIndex={0}
                role="img"
                aria-label={`${item.name}, ${yearLabel(point.year)}: ${point.value}`}
                onMouseEnter={() =>
                  setHover({
                    x: xOf(point.year),
                    y: yOf(point.value),
                    year: point.year,
                    value: point.value,
                    name: item.name,
                  })
                }
                onFocus={() =>
                  setHover({
                    x: xOf(point.year),
                    y: yOf(point.value),
                    year: point.year,
                    value: point.value,
                    name: item.name,
                  })
                }
                onBlur={() => setHover(null)}
              />
            ))}
          </g>
        ))}
      </svg>
      {hover && (
        <div
          id={tipId}
          role="status"
          className="pointer-events-none absolute z-10 border border-[var(--merc-line)] bg-[var(--merc-bg)] px-3 py-2 text-[14px] text-[var(--merc-text)]"
          style={{
            left: `min(calc(${(hover.x / width) * 100}% + 12px), calc(100% - 10rem))`,
            top: 96 + hover.y * 0.35,
          }}
        >
          <div className="text-[var(--merc-muted)]">{hover.name}</div>
          <div>
            {yearLabel(hover.year)}, {hover.value}
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Year</th>
            {drawn.map((item) => (
              <th key={item.name}>{item.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drawn[0]?.points.map((point, index) => (
            <tr key={`${point.year}-${index}`}>
              <td>{yearLabel(point.year)}</td>
              {drawn.map((item) => (
                <td key={item.name}>{item.points[index]?.value ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
