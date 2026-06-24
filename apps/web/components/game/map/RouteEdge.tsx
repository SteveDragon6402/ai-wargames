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

/** Road: thick amber — main supply route */
function RoadEdge({ id, path, labelX, labelY, label, markerEnd }: EdgePartProps) {
  return (
    <>
      {/* Soft outer glow */}
      <BaseEdge
        id={`${id}-glow`}
        path={path}
        style={{ stroke: "#7c3a00", strokeWidth: 12, strokeOpacity: 0.25 }}
        interactionWidth={20}
      />
      {/* Dark border */}
      <BaseEdge
        id={`${id}-border`}
        path={path}
        style={{ stroke: "#3a1a00", strokeWidth: 6, strokeOpacity: 1 }}
        interactionWidth={20}
      />
      {/* Main amber fill */}
      <BaseEdge
        id={`${id}-outer`}
        path={path}
        style={{ stroke: "#c8941a", strokeWidth: 4, strokeOpacity: 1 }}
        interactionWidth={20}
      />
      {/* Bright centre stripe */}
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: "#f0b429", strokeWidth: 1.5, strokeOpacity: 0.6 }}
        markerEnd={markerEnd}
        interactionWidth={20}
      />
      {label && <EdgeLabel x={labelX} y={labelY} text={label} />}
    </>
  );
}

/** River: deep blue with crossing indicator */
function RiverEdge({ id, path, labelX, labelY, label, markerEnd }: EdgePartProps) {
  return (
    <>
      {/* Wide deep glow */}
      <BaseEdge
        id={`${id}-glow`}
        path={path}
        style={{ stroke: "#023e5a", strokeWidth: 12, strokeOpacity: 0.4 }}
        interactionWidth={18}
      />
      {/* Dark border */}
      <BaseEdge
        id={`${id}-border`}
        path={path}
        style={{ stroke: "#012535", strokeWidth: 6, strokeOpacity: 1 }}
        interactionWidth={18}
      />
      {/* Main river */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: "#2d9ccd",
          strokeWidth: 3.5,
          strokeDasharray: "12 5",
          strokeOpacity: 0.9,
        }}
        markerEnd={markerEnd}
        interactionWidth={18}
      />
      {label && <EdgeLabel x={labelX} y={labelY} text={label} />}
    </>
  );
}

/** Rugged trail: earthy dashed path */
function TrailEdge({ id, path, labelX, labelY, label, markerEnd }: EdgePartProps) {
  return (
    <>
      {/* Soft outer shadow */}
      <BaseEdge
        id={`${id}-glow`}
        path={path}
        style={{ stroke: "#2a2318", strokeWidth: 8, strokeOpacity: 0.5 }}
        interactionWidth={16}
      />
      {/* Main trail */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: "#6b5e4a",
          strokeWidth: 2.5,
          strokeDasharray: "8 6",
          strokeOpacity: 0.85,
        }}
        markerEnd={markerEnd}
        interactionWidth={16}
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
        className="rounded-xs bg-canvas-soft/90 px-1 py-px text-[7px] font-medium uppercase tracking-wide text-mute ring-1 ring-hairline/60"
      >
        {text}
      </span>
    </EdgeLabelRenderer>
  );
}
