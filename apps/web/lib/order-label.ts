import type { Command } from "@wargame/shared";

export function orderLabel(
  cmd: Command,
  state?: { units: Record<string, { name: string; nodeId: string }> },
  nodeNames?: Record<string, string>
): string {
  const u = cmd.type !== "abandon_capital" ? state?.units[cmd.unitId] : null;
  const name = u?.name ?? cmd.type;
  const node = (id: string) => nodeNames?.[id] ?? id;
  const targetName = (id: string) => state?.units[id]?.name ?? id;

  switch (cmd.type) {
    case "move":
      return `${name} → ${node(cmd.targetNodeId)} · ${cmd.stance} / ${cmd.intention} · ${cmd.speed}`;
    case "dig_in":
      return `${name} digs in · ${cmd.intention}`;
    case "attack":
      return cmd.targetUnitId
        ? `${name} → ${targetName(cmd.targetUnitId)} · ${cmd.stance} / ${cmd.intention}`
        : `${name} attacks · ${cmd.stance} / ${cmd.intention}`;
    case "cover":
      return `${name} covers ${targetName(cmd.coverUnitId)}`;
    case "retreat":
      return `${name} → ${node(cmd.targetNodeId)} · ${cmd.speed}`;
    case "disengage":
      return `${name} disengages`;
    case "abandon_capital":
      return "Abandon capital → Helm's Deep";
    default:
      return "Unknown order";
  }
}

export function orderUnitId(cmd: Command): string | null {
  if (cmd.type === "abandon_capital") return "__abandon_capital__";
  return cmd.unitId;
}
