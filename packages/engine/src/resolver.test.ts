import { describe, expect, it } from "vitest";
import { GameGraph } from "./graph.js";
import {
  checkVictory,
  createInitialState,
  resolveTurn,
} from "./resolver.js";
import { initGameFromScenario, defaultScenariosRoot } from "./scenario.js";
import { validateCommand, ValidationError } from "./validator.js";
import { getDeniedNodes } from "./validator.js";

const root = defaultScenariosRoot();
const opts = () => {
  const { scenario } = initGameFromScenario(root, "rohan-vs-isengard");
  return {
    combat: scenario.combat,
    rohanFallbackCapital: scenario.fallbackCapital?.rohan,
  };
};

describe("resolveTurn v2", () => {
  it("moves unit to adjacent node", async () => {
    const { state: initial } = initGameFromScenario(root, "rohan-vs-isengard");
    const result = await resolveTurn(
      initial,
      [
        {
          factionId: "rohan",
          commands: [
            {
              type: "move",
              unitId: "rohan_king",
              targetNodeId: "westfold",
              speed: "normal",
              stance: "balanced",
              intention: "balanced",
            },
          ],
        },
        { factionId: "isengard", commands: [] },
      ],
      opts()
    );
    expect(result.state.units.rohan_king?.nodeId).toBe("westfold");
  });

  it("dig in when alone", async () => {
    const { state: initial } = initGameFromScenario(root, "rohan-vs-isengard");
    const result = await resolveTurn(
      initial,
      [
        {
          factionId: "rohan",
          commands: [
            { type: "dig_in", unitId: "rohan_king", intention: "hold" },
          ],
        },
        { factionId: "isengard", commands: [] },
      ],
      opts()
    );
    expect(result.state.units.rohan_king?.dugIn).toBeGreaterThan(0.3);
    expect(result.events.some((e) => e.type === "dig_in")).toBe(true);
  });

  it("abandons rohan capital", async () => {
    const { state: initial } = initGameFromScenario(root, "rohan-vs-isengard");
    const result = await resolveTurn(
      initial,
      [
        { factionId: "rohan", commands: [{ type: "abandon_capital" }] },
        { factionId: "isengard", commands: [] },
      ],
      opts()
    );
    expect(result.state.meta.capitalNodes.rohan).toBe("helms_deep");
  });

  it("detects capital capture", () => {
    const { map, scenario } = initGameFromScenario(root, "rohan-vs-isengard");
    let state = createInitialState(map, {
      id: scenario.id,
      capitalNodes: scenario.capitalNodes,
      units: [
        {
          id: "isengard_uruk",
          name: "Uruk",
          factionId: "isengard",
          nodeId: "edoras",
          attack: 9,
          defense: 6,
          strength: 1,
          morale: 80,
        },
      ],
    });
    expect(checkVictory(state)).toBe("isengard");
  });

  it("deny marks node when dug in", () => {
    const { state: initial } = initGameFromScenario(root, "rohan-vs-isengard");
    const dug = {
      ...initial,
      units: {
        ...initial.units,
        rohan_king: {
          ...initial.units.rohan_king!,
          dugIn: 0.5,
        },
      },
    };
    const denied = getDeniedNodes(
      dug,
      [{ type: "dig_in", unitId: "rohan_king", intention: "deny" }],
      0.35
    );
    expect(denied.has("edoras")).toBe(true);
  });

  it("rejects assault without aggressive stance on move", () => {
    const { state } = initGameFromScenario(root, "rohan-vs-isengard");
    const graph = new GameGraph(state.map);
    expect(() =>
      validateCommand(state, graph, "rohan", {
        type: "move",
        unitId: "rohan_king",
        targetNodeId: "westfold",
        speed: "normal",
        stance: "defensive",
        intention: "assault",
      })
    ).toThrow(ValidationError);
  });
});

describe("validateCommand", () => {
  it("rejects move when engaged", () => {
    const { state } = initGameFromScenario(root, "rohan-vs-isengard");
    const graph = new GameGraph(state.map);
    const engaged = {
      ...state,
      units: {
        ...state.units,
        rohan_king: { ...state.units.rohan_king!, engaged: true },
        isengard_gap: {
          ...state.units.isengard_gap!,
          nodeId: "edoras",
          engaged: true,
        },
      },
    };
    expect(() =>
      validateCommand(engaged, graph, "rohan", {
        type: "move",
        unitId: "rohan_king",
        targetNodeId: "westfold",
        speed: "normal",
        stance: "balanced",
        intention: "balanced",
      })
    ).toThrow();
  });
});
