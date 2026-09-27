import { NextRequest, NextResponse } from "next/server";
import { anthropicClient } from "../../model";
import { reviewTownTrigger } from "../review";

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });
  const body = (await req.json().catch(() => null)) as { why?: string } | null;
  if (!body?.why?.trim()) return NextResponse.json({ error: "There is no promise to connect." }, { status: 400 });
  const reviewed = await reviewTownTrigger(client, body.why);
  if ("error" in reviewed) return NextResponse.json({ error: reviewed.error }, { status: 500 });
  return NextResponse.json({ trigger: reviewed.trigger });
}
