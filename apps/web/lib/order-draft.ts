import type {
  AttackIntention,
  Command,
  DigInIntention,
  MoveIntention,
  Speed,
  Stance,
} from "@wargame/shared";
import type { ActionType } from "./actions";

export interface OrderDraft {
  action: ActionType;
  unitId: string;
  targetNodeId?: string;
  targetUnitId?: string;
  coverUnitId?: string;
  breakthroughTargetNodeId?: string;
  speed: Speed;
  stance: Stance;
  moveIntention: MoveIntention;
  attackIntention: AttackIntention;
  digInIntention: DigInIntention;
}

export function createDraft(action: ActionType, unitId: string): OrderDraft {
  return {
    action,
    unitId,
    speed: "normal",
    stance: "balanced",
    moveIntention: "balanced",
    attackIntention: "attack",
    digInIntention: "hold",
  };
}

export function draftNeedsNode(draft: OrderDraft): boolean {
  return draft.action === "move" || draft.action === "retreat";
}

export function draftNeedsEnemy(draft: OrderDraft): boolean {
  // Breakthrough targets a node, not a unit — only assault needs a specific enemy target
  return draft.action === "attack" && draft.attackIntention === "assault";
}

export function draftNeedsAlly(draft: OrderDraft): boolean {
  return draft.action === "cover";
}

export function draftNeedsBreakthroughNode(draft: OrderDraft): boolean {
  return draft.action === "attack" && draft.attackIntention === "breakthrough";
}

export function isDraftComplete(draft: OrderDraft): boolean {
  switch (draft.action) {
    case "move":
    case "retreat":
      return Boolean(draft.targetNodeId);
    case "attack":
      if (draft.attackIntention === "assault") {
        if (draft.stance !== "aggressive") return false;
        if (!draft.targetUnitId) return false;
      }
      if (draft.attackIntention === "breakthrough") {
        return Boolean(draft.breakthroughTargetNodeId);
      }
      return true;
    case "cover":
      return Boolean(draft.coverUnitId);
    case "dig_in":
      return true;
    case "disengage":
      return true;
    default:
      return false;
  }
}

export function commandToDraft(cmd: Command): OrderDraft | null {
  switch (cmd.type) {
    case "move":
      return {
        action: "move",
        unitId: cmd.unitId,
        targetNodeId: cmd.targetNodeId,
        speed: cmd.speed,
        stance: cmd.stance,
        moveIntention: cmd.intention,
        attackIntention: "attack",
        digInIntention: "hold",
      };
    case "retreat":
      return {
        action: "retreat",
        unitId: cmd.unitId,
        targetNodeId: cmd.targetNodeId,
        speed: cmd.speed,
        stance: "balanced",
        moveIntention: "balanced",
        attackIntention: "attack",
        digInIntention: "hold",
      };
    case "attack":
      return {
        action: "attack",
        unitId: cmd.unitId,
        targetUnitId: cmd.targetUnitId,
        breakthroughTargetNodeId: cmd.breakthroughTargetNodeId,
        stance: cmd.stance,
        attackIntention: cmd.intention,
        speed: "normal",
        moveIntention: "balanced",
        digInIntention: "hold",
      };
    case "cover":
      return {
        action: "cover",
        unitId: cmd.unitId,
        coverUnitId: cmd.coverUnitId,
        speed: "normal",
        stance: "balanced",
        moveIntention: "balanced",
        attackIntention: "attack",
        digInIntention: "hold",
      };
    case "dig_in":
      return {
        action: "dig_in",
        unitId: cmd.unitId,
        digInIntention: cmd.intention,
        speed: "normal",
        stance: "balanced",
        moveIntention: "balanced",
        attackIntention: "attack",
      };
    case "disengage":
      return {
        action: "disengage",
        unitId: cmd.unitId,
        speed: "normal",
        stance: "balanced",
        moveIntention: "balanced",
        attackIntention: "attack",
        digInIntention: "hold",
      };
    default:
      return null;
  }
}

export function buildCommandFromDraft(draft: OrderDraft): Command {
  switch (draft.action) {
    case "move":
      return {
        type: "move",
        unitId: draft.unitId,
        targetNodeId: draft.targetNodeId!,
        speed: draft.speed,
        stance: draft.stance,
        intention: draft.moveIntention,
      };
    case "retreat":
      return {
        type: "retreat",
        unitId: draft.unitId,
        targetNodeId: draft.targetNodeId!,
        speed: draft.speed,
      };
    case "attack":
      return {
        type: "attack",
        unitId: draft.unitId,
        targetUnitId: draft.targetUnitId,
        stance: draft.stance,
        intention: draft.attackIntention,
        breakthroughTargetNodeId: draft.breakthroughTargetNodeId,
      };
    case "cover":
      return {
        type: "cover",
        unitId: draft.unitId,
        coverUnitId: draft.coverUnitId!,
      };
    case "dig_in":
      return {
        type: "dig_in",
        unitId: draft.unitId,
        intention: draft.digInIntention,
      };
    case "disengage":
      return { type: "disengage", unitId: draft.unitId };
    default:
      throw new Error("Unknown action");
  }
}

export type MapPickMode =
  | "none"
  | "destination"
  | "enemy"
  | "ally"
  | "breakthrough";

export function mapPickModeForDraft(draft: OrderDraft | null): MapPickMode {
  if (!draft) return "none";
  if (draftNeedsNode(draft) && !draft.targetNodeId) return "destination";
  if (draftNeedsEnemy(draft) && !draft.targetUnitId) return "enemy";
  if (draftNeedsAlly(draft) && !draft.coverUnitId) return "ally";
  if (draftNeedsBreakthroughNode(draft) && !draft.breakthroughTargetNodeId) {
    return "breakthrough";
  }
  return "none";
}
