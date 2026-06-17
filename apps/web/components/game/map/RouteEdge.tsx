"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

export type RouteType = "road" | "rugged" | "river";

export interface RouteEdgeData {
  label?: string;
  routeType?: RouteType;
  curvature?: number;
  [key: string]: unknown;
}

export function RouteEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as RouteEdgeData;
  const curvature = d.curvature ?? 0.2;
  const routeType = d.routeType ?? "rugged";

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature,
  });

  if (routeType === "road") {
    return (
      <RoadEdge
        id={id}
        path={edgePath}
        labelX={labelX}
        labelY={labelY}
        label={d.label}
        style={style}
        markerEnd={markerEnd}
      />
    );
  }

  if (routeType === "river") {
    return (
      <RiverEdge
        id={id}
        path={edgePath}
        labelX={labelX}
        labelY={labelY}
        label={d.label}
        style={style}
        markerEnd={markerEnd}
      />
    );
  }

  /* Rugged trail — dashed single line */
  return (
    <TrailEdge
      id={id}
      path={edgePath}
      labelX={labelX}
      labelY={labelY}
      label={d.label}
      style={style}
      markerEnd={markerEnd}
    />
  );
}

/* ------------------------------------------------------------------ */

interface EdgePartProps {
  id: string;
  path: string;
  labelX: number;
  labelY: number;
  label?: string;
  style?: React.CSSProperties;
  markerEnd?: string;
}

/** Road: thick amber glow underlay + thinner solid line giving a "paved road" look */
function RoadEdge({ id, path, labelX, labelY, label, style, markerEnd }: EdgePartProps) {
  return (
    <>
      {/* Wide amber glow */}
      <BaseEdge
        id={`${id}-glow`}
        path={path}
        style={{ stroke: "#92400e", strokeWidth: 8, strokeOpacity: 0.4 }}
        interactionWidth={16}
      />
      {/* Outer amber line */}
      <BaseEdge
        id={`${id}-outer`}
        path={path}
        style={{ stroke: "#d97706", strokeWidth: 4, strokeOpacity: 0.9 }}
        interactionWidth={16}
      />
      {/* Inner lighter centre stripe */}
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: "#fbbf24", strokeWidth: 1.5, strokeOpacity: 0.7 }}
        markerEnd={markerEnd}
        interactionWidth={16}
      />
      {label && <EdgeLabel x={labelX} y={labelY} text={label} />}
    </>
  );
}

/** River: wide blue glow + wavy dashed line */
function RiverEdge({ id, path, labelX, labelY, label, style, markerEnd }: EdgePartProps) {
  return (
    <>
      {/* Wide glow */}
      <BaseEdge
        id={`${id}-glow`}
        path={path}
        style={{ stroke: "#0369a1", strokeWidth: 8, strokeOpacity: 0.3 }}
        interactionWidth={16}
      />
      {/* Main river line */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: "#38bdf8",
          strokeWidth: 3,
          strokeDasharray: "10 4",
          strokeOpacity: 0.85,
        }}
        markerEnd={markerEnd}
        interactionWidth={16}
      />
      {label && <EdgeLabel x={labelX} y={labelY} text={label} />}
    </>
  );
}

/** Rugged trail: thin dashed grey */
function TrailEdge({ id, path, labelX, labelY, label, style, markerEnd }: EdgePartProps) {
  return (
    <>
      <BaseEdge
        id={`${id}-under`}
        path={path}
        style={{ stroke: "#57534e", strokeWidth: 5, strokeOpacity: 0.25 }}
        interactionWidth={14}
      />
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: "#a8a29e",
          strokeWidth: 2,
          strokeDasharray: "7 5",
          strokeOpacity: 0.7,
        }}
        markerEnd={markerEnd}
        interactionWidth={14}
      />
      {label && <EdgeLabel x={labelX} y={labelY} text={label} />}
    </>
  );
}

function EdgeLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <EdgeLabelRenderer>
      <span
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
          pointerEvents: "none",
        }}
        className="rounded bg-[#14110d]/90 px-1 py-px text-[7px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-800/60"
      >
        {text}
      </span>
    </EdgeLabelRenderer>
  );
}
