import type { CosTranslation, FactionId, SecretTestState } from "../types";
import { translateDirective, writeBriefing } from "./cos";
import { openingTranslations, runGmTurn } from "./gm";
import { emptyTranslation, isOpeningResolve } from "./state";

function namesFrom(
  players: { factionId: string; displayName: string }[]
): Record<FactionId, string> {
  return {
    red: players.find((p) => p.factionId === "red")?.displayName ?? "Red",
    blue: players.find((p) => p.factionId === "blue")?.displayName ?? "Blue",
  };
}

export async function runMonthPipeline(
  state: SecretTestState,
  players: { factionId: string; displayName: string }[]
): Promise<SecretTestState> {
  const names = namesFrom(players);
  const opening = isOpeningResolve(state);

  let translations: Record<FactionId, CosTranslation> = openingTranslations();
  if (!opening) {
    const [red, blue] = await Promise.all([
      translateDirective(state, "red", names.red),
      translateDirective(state, "blue", names.blue),
    ]);
    translations = { red: red ?? emptyTranslation(), blue: blue ?? emptyTranslation() };
  }

  const { next, briefingNote } = await runGmTurn(state, translations, names, opening);

  const [redBrief, blueBrief] = await Promise.all([
    writeBriefing(next, "red", names.red, names.blue, briefingNote),
    writeBriefing(next, "blue", names.blue, names.red, briefingNote),
  ]);

  return {
    ...next,
    briefings: { red: redBrief.letter, blue: blueBrief.letter },
    opponentRumors: { red: redBrief.opponentRumor, blue: blueBrief.opponentRumor },
    recommendations: { red: redBrief.recommendations, blue: blueBrief.recommendations },
  };
}
