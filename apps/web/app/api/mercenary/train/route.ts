import { NextRequest, NextResponse } from "next/server";
import { anthropicClient, createMessage, textOf } from "../model";

interface TrainUnit {
  id: string;
  name: string;
  origin: string;
  lines: [string, string, string];
}

function unitsOf(body: { units?: TrainUnit[] }): TrainUnit[] | null {
  if (!Array.isArray(body.units) || body.units.length !== 2) return null;
  for (const unit of body.units) {
    if (!unit?.id || !unit.name || !unit.origin || !Array.isArray(unit.lines) || unit.lines.length !== 3) return null;
  }
  return body.units;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    mode?: string;
    drill?: string;
    units?: TrainUnit[];
  } | null;
  if (!body) return NextResponse.json({ error: "The drill request was unreadable." }, { status: 400 });
  const units = unitsOf(body);
  if (!units) return NextResponse.json({ error: "Training needs two units." }, { status: 400 });

  if (body.mode === "suggest") {
    const response = await createMessage(client, {
      max_tokens: 200,
      system:
        "Suggest three drills for two mercenary units. Each drill is exactly four words. Reply with three lines, nothing else.",
      messages: [
        {
          role: "user",
          content: units
            .map((unit) => `${unit.name}. ${unit.origin} ${unit.lines.join(" ")}`)
            .join("\n"),
        },
      ],
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
    const drills = textOf(response)
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (drills.length < 2) return NextResponse.json({ error: "No drills came back." }, { status: 500 });
    return NextResponse.json({ drills });
  }

  if (!body.drill?.trim()) return NextResponse.json({ error: "Say what the drill is." }, { status: 400 });
  const response = await createMessage(client, {
    max_tokens: 500,
    system: `Rewrite the three living lines of each unit after a week of drill. Do not change who they were raised as.
Reply in this exact shape, one unit then the other:
UNIT <id>
<line>
<line>
<line>`,
    messages: [
      {
        role: "user",
        content: `Drill: ${body.drill.trim()}\n\n${units
          .map((unit) => `UNIT ${unit.id}\nRaised as, fixed: ${unit.origin}\n${unit.lines.join("\n")}`)
          .join("\n\n")}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
  const lines: Record<string, [string, string, string]> = {};
  const chunks = textOf(response).split(/^UNIT\s+/m).map((chunk) => chunk.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const [idLine, ...rest] = chunk.split(/\n/).map((line) => line.trim()).filter(Boolean);
    const id = idLine?.split(/\s+/)[0];
    if (!id || rest.length < 3) continue;
    lines[id] = [rest[0], rest[1], rest[2]];
  }
  if (units.some((unit) => !lines[unit.id])) {
    return NextResponse.json({ error: "The drill did not come back for both units." }, { status: 500 });
  }
  return NextResponse.json({ lines });
}
