import type {
  Army,
  ArmyConditionUpdate,
  CharacterId,
  CharacterState,
  FallenFigure,
} from "../types";
import { factionLordId, findCharacterIdByName } from "../data/characters";

/**
 * Word of a named death carries beyond the field. Calibrated: a lord shaking
 * the whole faction, a commander a hard blow, a notable a local sting.
 */
export function deathRipple(
  fallen: FallenFigure[],
  characters: Record<CharacterId, CharacterState>,
  armies: Army[]
): ArmyConditionUpdate[] {
  if (fallen.length === 0 || armies.length === 0) return [];

  type Weight = "lord" | "commander" | "notable";
  const blows: { name: string; faction: CharacterState["faction"]; weight: Weight }[] =
    [];

  for (const f of fallen) {
    const id = findCharacterIdByName(characters, f.name);
    const c = id ? characters[id] : undefined;
    if (!c) continue;
    let weight: Weight = "notable";
    if (c.role === "lord" || c.id === factionLordId(c.faction)) weight = "lord";
    else if (c.role === "commander" || f.isLeader) weight = "commander";
    blows.push({ name: c.name, faction: c.faction, weight });
  }

  if (blows.length === 0) return [];

  const ownLine = (faction: CharacterState["faction"]): string | null => {
    const mine = blows.filter((b) => b.faction === faction);
    if (mine.length === 0) return null;
    const lord = mine.find((b) => b.weight === "lord");
    if (lord) {
      return `Word has reached them that ${lord.name} is dead. The host is shaken to its bones.`;
    }
    const cmd = mine.find((b) => b.weight === "commander");
    if (cmd) {
      return `Word that ${cmd.name} has fallen runs through the ranks. The blow lands hard.`;
    }
    const n = mine[0];
    return `They hear that ${n.name} died in the fighting. A grim murmur, then they go on.`;
  };

  const foeLine = (faction: CharacterState["faction"]): string | null => {
    const theirs = blows.filter((b) => b.faction !== faction);
    if (theirs.length === 0) return null;
    const lord = theirs.find((b) => b.weight === "lord");
    if (lord) {
      return `Word that ${lord.name} is dead lifts the host — the enemy's head is gone.`;
    }
    const cmd = theirs.find((b) => b.weight === "commander");
    if (cmd) {
      return `They hear ${cmd.name} fell. A grim satisfaction, not a feast.`;
    }
    return null;
  };

  return armies.map((army) => {
    const own = ownLine(army.faction);
    const foe = foeLine(army.faction);
    const morale = own ?? foe ?? army.morale;
    return {
      armyId: army.id,
      morale,
      tiredness: army.tiredness,
      stance: army.stance,
    };
  });
}

/** Fold a ripple into existing battle updates — append, do not replace. */
export function mergeRipple(
  existing: ArmyConditionUpdate[],
  ripple: ArmyConditionUpdate[]
): ArmyConditionUpdate[] {
  const byId = new Map(existing.map((u) => [u.armyId, { ...u }]));
  for (const r of ripple) {
    const cur = byId.get(r.armyId);
    if (!cur) {
      byId.set(r.armyId, r);
      continue;
    }
    if (r.morale && r.morale !== cur.morale) {
      cur.morale = `${cur.morale} ${r.morale}`;
    }
  }
  return [...byId.values()];
}
