import { NextRequest, NextResponse } from "next/server";
import { anthropicClient, createMessage, textOf } from "../../model";

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    companyName?: string;
    units?: { name: string; count: number; lines: string[] }[];
    decisions?: { week: number; text: string }[];
    reputation?: Record<string, string>;
  } | null;
  if (!body?.companyName || !Array.isArray(body.units)) {
    return NextResponse.json({ error: "The year is missing its company." }, { status: 400 });
  }

  const units = body.units
    .map((unit) => `${unit.name}, ${unit.count}. ${(unit.lines ?? []).join(" ")}`)
    .join("\n");
  const decisions = (body.decisions ?? []).map((item) => `Week ${item.week}: ${item.text}`).join("\n") || "No deed was written down.";
  const standing = Object.entries(body.reputation ?? {})
    .map(([key, text]) => `${key}: ${text}`)
    .join("\n");

  const response = await createMessage(client, {
    max_tokens: 350,
    system:
      "You close the year of a mercenary company. One short paragraph. Use only the units, the decisions, and the standings you are given. Do not invent a battle, a death, or a patron.",
    messages: [
      {
        role: "user",
        content: `${body.companyName}\n${units}\n\nDecisions:\n${decisions}\n\nStanding:\n${standing}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
  const closing = textOf(response);
  if (!closing) return NextResponse.json({ error: "The year came back empty." }, { status: 500 });
  return NextResponse.json({ closing });
}
