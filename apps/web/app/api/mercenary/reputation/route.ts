import { NextRequest, NextResponse } from "next/server";
import { REPUTATION_LABEL, type ReputationKey } from "@/app/mercenary/lib/types";
import { anthropicClient, createMessage, textOf } from "../model";

const KEYS = new Set<ReputationKey>(["holt", "ashmarch", "mere", "nobles", "peasants"]);

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    key?: ReputationKey;
    companyName?: string;
    current?: string;
    decisions?: { week: number; text: string }[];
    justHappened?: string;
  } | null;

  if (!body?.key || !KEYS.has(body.key) || !body.companyName?.trim() || !body.justHappened?.trim()) {
    return NextResponse.json({ error: "Reputation is missing its subject." }, { status: 400 });
  }

  const log = (body.decisions ?? []).map((item) => `Week ${item.week}: ${item.text}`).join("\n") || "Nothing significant yet.";
  const response = await createMessage(client, {
    max_tokens: 400,
    system: `You keep one reputation for a mercenary company: ${REPUTATION_LABEL[body.key]}.
Write two or three sentences of how that party now regards the company. Prose only. No title, no list, no score.
A new company is unknown. Later deeds move the standing. Do not invent deeds that are not in the log.`,
    messages: [
      {
        role: "user",
        content: `Company: ${body.companyName}
Current standing: ${body.current?.trim() || "None yet. They are a new mercenary company."}
Significant decisions:
${log}
What just happened: ${body.justHappened}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
  const text = textOf(response);
  if (!text) return NextResponse.json({ error: "Reputation came back empty." }, { status: 500 });
  return NextResponse.json({ text });
}
