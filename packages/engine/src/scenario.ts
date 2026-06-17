import type { MapDef, ScenarioDef } from "@wargame/shared";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInitialState } from "./resolver.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadScenario(
  scenariosRoot: string,
  scenarioId: string
): { map: MapDef; scenario: ScenarioDef } {
  const base = join(scenariosRoot, scenarioId);
  const map = JSON.parse(readFileSync(join(base, "map.json"), "utf-8")) as MapDef;
  const scenario = JSON.parse(
    readFileSync(join(base, "scenario.json"), "utf-8")
  ) as ScenarioDef;
  return { map, scenario };
}

export function defaultScenariosRoot(): string {
  return join(__dirname, "../../../scenarios");
}

export function initGameFromScenario(scenariosRoot: string, scenarioId: string) {
  const { map, scenario } = loadScenario(scenariosRoot, scenarioId);
  const state = createInitialState(map, {
    id: scenario.id,
    capitalNodes: scenario.capitalNodes,
    units: scenario.units,
  });
  return { map, scenario, state };
}
