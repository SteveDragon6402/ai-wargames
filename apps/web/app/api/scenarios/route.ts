import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getScenariosDir } from "@/lib/env";

export interface ScenarioMeta {
  id: string;
  name: string;
  factions: string[];
}

export async function GET() {
  try {
    const dir = getScenariosDir();
    const entries = readdirSync(dir, { withFileTypes: true });
    const scenarios: ScenarioMeta[] = entries
      .filter((e) => e.isDirectory())
      .flatMap((e) => {
        try {
          const raw = readFileSync(join(dir, e.name, "scenario.json"), "utf-8");
          const s = JSON.parse(raw) as { id: string; name: string; factions: string[] };
          return [{ id: s.id, name: s.name, factions: s.factions ?? [] }];
        } catch {
          return [];
        }
      });
    return NextResponse.json({ scenarios });
  } catch (e) {
    console.error("[GET /api/scenarios]", e);
    return NextResponse.json({ scenarios: [] });
  }
}
