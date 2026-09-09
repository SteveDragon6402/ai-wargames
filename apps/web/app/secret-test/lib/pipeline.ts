import { PIPELINE_BUDGET_MS } from "../types";
import type { CosTranslation, FactionId, SecretTestState } from "../types";
import { translateDirective, writeBriefing } from "./cos";
import { templateBriefing } from "./desk";
import { applyGmOutcome, openingTranslations, runGmTurn } from "./gm";
import { emptyTranslation, isOpeningResolve } from "./state";
import { withTimeoutFallback } from "./timeout";

function namesFrom(
  players: { factionId: string; displayName: string }[]
): Record<FactionId, string> {
  return {
    red: players.find((p) => p.factionId === "red")?.displayName ?? "Red",
    blue: players.find((p) => p.factionId === "blue")?.displayName ?? "Blue",
  };
}

function applyBriefs(
  next: SecretTestState,
  red: { letter: string; opponentRumor: string; recommendations: SecretTestState["recommendations"]["red"] },
  blue: { letter: string; opponentRumor: string; recommendations: SecretTestState["recommendations"]["blue"] }
): SecretTestState {
  return {
    ...next,
    briefings: { red: red.letter, blue: blue.letter },
    opponentRumors: { red: red.opponentRumor, blue: blue.opponentRumor },
    recommendations: { red: red.recommendations, blue: blue.recommendations },
  };
}

function closeWithTemplates(
  state: SecretTestState,
  translations: Record<FactionId, CosTranslation>,
  names: Record<FactionId, string>,
  opening: boolean,
  note: string
): SecretTestState {
  const acc = {
    scratchpad: state.scratchpad,
    applied: !opening,
    moneyDelta: {
      red: opening ? 0 : -(translations.red.costKr || 0),
      blue: opening ? 0 : -(translations.blue.costKr || 0),
    },
    seatPatches: [] as { id: string; lean?: number; turnout?: number }[],
    issues: state.issues,
    debateQuestions: state.debateQuestions,
    noteForBriefings: note,
    pollsUsed: 0,
  };
  const { next, briefingNote } = applyGmOutcome(state, translations, acc, opening);
  return applyBriefs(
    next,
    templateBriefing(next, "red", names.red, names.blue, briefingNote),
    templateBriefing(next, "blue", names.blue, names.red, briefingNote)
  );
}

export async function runMonthPipeline(
  state: SecretTestState,
  players: { factionId: string; displayName: string }[]
): Promise<SecretTestState> {
  const names = namesFrom(players);
  const opening = isOpeningResolve(state);
  const started = Date.now();
  const left = () => PIPELINE_BUDGET_MS - (Date.now() - started);

  let translations: Record<FactionId, CosTranslation> = openingTranslations();
  if (!opening) {
    if (left() < 20_000) {
      translations = {
        red: {
          ...emptyTranslation(),
          executed: state.pendingActions.red?.text?.slice(0, 280) || "No package.",
          costKr: Math.min(150_000, state.cash.red),
          prioritiesForGm: state.pendingActions.red?.text?.slice(0, 400) || "",
        },
        blue: {
          ...emptyTranslation(),
          executed: state.pendingActions.blue?.text?.slice(0, 280) || "No package.",
          costKr: Math.min(150_000, state.cash.blue),
          prioritiesForGm: state.pendingActions.blue?.text?.slice(0, 400) || "",
        },
      };
    } else {
      const [red, blue] = await Promise.all([
        translateDirective(state, "red", names.red),
        translateDirective(state, "blue", names.blue),
      ]);
      translations = { red: red ?? emptyTranslation(), blue: blue ?? emptyTranslation() };
    }
  }

  if (left() < 12_000) {
    return closeWithTemplates(
      state,
      translations,
      names,
      opening,
      "Month closed on the clock. Costs taken as filed. Full war-room write skipped."
    );
  }

  const gm = await withTimeoutFallback(
    runGmTurn(state, translations, names, opening),
    Math.max(8_000, left() - 16_000),
    "gm-turn",
    null
  );

  if (!gm) {
    return closeWithTemplates(
      state,
      translations,
      names,
      opening,
      "The war room ran long. We booked the costs and kept the map as it was."
    );
  }

  const { next, briefingNote } = gm;
  const useTemplates = left() < 10_000;
  const [redBrief, blueBrief] = useTemplates
    ? [
        templateBriefing(next, "red", names.red, names.blue, briefingNote),
        templateBriefing(next, "blue", names.blue, names.red, briefingNote),
      ]
    : await Promise.all([
        writeBriefing(next, "red", names.red, names.blue, briefingNote),
        writeBriefing(next, "blue", names.blue, names.red, briefingNote),
      ]);

  return applyBriefs(next, redBrief, blueBrief);
}
