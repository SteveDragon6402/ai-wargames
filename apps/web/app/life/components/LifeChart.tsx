"use client";

import { useId, useState } from "react";
import { readingAt, type LifeChartRecord } from "../lib/chronicle";

function yearLabel(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`;
  return String(year);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

function amountOf(value: number, unit: string): string {
  return `${formatCount(value)} ${unit}`;
}

function yearPhrase(kind: LifeChartRecord["kind"], year: number): string {
  if (kind === "running") return `By ${yearLabel(year)}`;
  return `In ${yearLabel(year)}`;
}

export function LifeChart({
  chart,
  deathYear,
  ink,
  fill,
}: {
  chart: LifeChartRecord;
  deathYear?: number | null;
  ink: string;
  fill?: string;
}) {
  const points = [...chart.points].sort((a, b) => a.year - b.year);
  const last = points[points.length - 1];
  const [hover, setHover] = useState<ReturnType<typeof readingAt> | null>(null);
  const tipId = useId();
  if (!last) return null;
  const width = 720;
  const height = 200;
  const pad = { l: 52, r: 12, t: 12, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const minYear = Math.min(...points.map((point) => point.year));
  const maxYear = Math.max(...points.map((point) => point.year));
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const xOf = (year: number) => (maxYear === minYear ? pad.l + innerW / 2 : pad.l + ((year - minYear) / (maxYear - minYear)) * innerW);
  const yOf = (value: number) => pad.t + innerH - (Math.max(0, value) / maxValue) * innerH;
  const yearTicks = [0, 1, 2, 3].map((step) => Math.round(minYear + ((maxYear - minYear) * step) / 3));
  const valueTicks = [0, 0.5, 1].map((step) => Math.round(maxValue * step));
  const base = pad.t + innerH;
  const reading = hover ?? last;
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xOf(point.year).toFixed(1)} ${yOf(point.value).toFixed(1)}`)
    .join(" ");

  function yearFromPointer(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return minYear;
    const x = ((event.clientX - box.left) / box.width) * width;
    const ratio = maxYear === minYear ? 0 : (x - pad.l) / innerW;
    const year = minYear + ratio * (maxYear - minYear);
    return Math.round(Math.min(maxYear, Math.max(minYear, year)));
  }

  function follow(event: React.PointerEvent<SVGSVGElement>) {
    const next = readingAt(points, yearFromPointer(event));
    setHover((current) => (current && current.year === next.year && current.value === next.value ? current : next));
  }

  return (
    <figure className="life-ledger">
      <div id={tipId} className="min-h-[4.5rem]">
        <p className="font-gothic text-4xl leading-none tabular-nums text-[var(--merc-text)]">{amountOf(reading.value, chart.unit)}</p>
        <p className="mt-2 text-[15px] text-[var(--merc-muted)]">{yearPhrase(chart.kind, reading.year)}</p>
        <p className="mt-1 max-w-prose text-[17px] leading-snug text-[var(--merc-text)]">{reading.note}</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={chart.title}
        aria-describedby={tipId}
        className="mt-5 w-full touch-none"
        onPointerMove={follow}
        onPointerDown={follow}
        onPointerLeave={() => setHover(null)}
      >
        {valueTicks.map((value) => (
          <g key={`v-${value}`}>
            <line x1={pad.l} y1={yOf(value)} x2={width - pad.r} y2={yOf(value)} stroke="var(--merc-line)" strokeOpacity="0.35" />
            <text
              x={pad.l - 8}
              y={yOf(value) + 4}
              textAnchor="end"
              fill="var(--merc-muted)"
              fontSize="12"
              fontFamily="var(--font-book), Georgia, serif"
            >
              {formatCount(value)}
            </text>
          </g>
        ))}
        <line x1={pad.l} y1={base} x2={width - pad.r} y2={base} stroke="var(--merc-line)" />
        {yearTicks.map((year) => (
          <text
            key={year}
            x={xOf(year)}
            y={height - 6}
            textAnchor="middle"
            fill="var(--merc-muted)"
            fontSize="12"
            fontFamily="var(--font-book), Georgia, serif"
          >
            {yearLabel(year)}
          </text>
        ))}
        {deathYear !== undefined && deathYear !== null && deathYear >= minYear && deathYear <= maxYear && (
          <line x1={xOf(deathYear)} y1={pad.t} x2={xOf(deathYear)} y2={base} stroke="var(--merc-red)" strokeDasharray="2 5" />
        )}
        {fill && points.length > 1 && (
          <path
            className="life-fill"
            d={`${line} L${xOf(points[points.length - 1].year).toFixed(1)} ${base} L${xOf(points[0].year).toFixed(1)} ${base} Z`}
            fill={fill}
          />
        )}
        <path className="life-stroke" d={line} fill="none" stroke={ink} strokeWidth="2" pathLength={1} />
        {points.map((point) => (
          <rect
            key={point.year}
            x={xOf(point.year) - 3}
            y={yOf(point.value) - 3}
            width="6"
            height="6"
            fill="var(--merc-bg)"
            stroke={ink}
            strokeWidth="1.75"
            pointerEvents="none"
          />
        ))}
        {reading && (
          <g pointerEvents="none">
            <line x1={xOf(reading.year)} y1={pad.t} x2={xOf(reading.year)} y2={base} stroke={ink} strokeOpacity="0.45" />
            <rect
              x={xOf(reading.year) - 5}
              y={yOf(reading.value) - 5}
              width="10"
              height="10"
              fill="var(--merc-bg)"
              stroke={ink}
              strokeWidth="2"
            />
          </g>
        )}
        <rect x={pad.l} y={pad.t} width={innerW} height={innerH} fill="transparent" className="cursor-crosshair" />
      </svg>
      <label className="mt-3 block">
        <span className="sr-only">{chart.title}, year</span>
        <input
          type="range"
          min={minYear}
          max={maxYear}
          value={reading.year}
          aria-valuetext={`${amountOf(reading.value, chart.unit)}. ${reading.note}`}
          onChange={(event) => setHover(readingAt(points, Number(event.target.value)))}
          className="w-full accent-[var(--merc-text)]"
        />
      </label>
      <figcaption className="mt-4">
        <p className="text-[14px] uppercase tracking-[0.12em] text-[var(--merc-muted)]">{chart.title}</p>
        <p className="mt-1 max-w-prose text-[16px] leading-snug text-[var(--merc-muted)]">{chart.why}</p>
      </figcaption>
      <table className="sr-only">
        <caption>
          {chart.title}. {chart.why}
        </caption>
        <thead>
          <tr>
            <th>Year</th>
            <th>{chart.unit}</th>
            <th>What moved</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.year}>
              <td>{yearLabel(point.year)}</td>
              <td>{amountOf(point.value, chart.unit)}</td>
              <td>{point.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
