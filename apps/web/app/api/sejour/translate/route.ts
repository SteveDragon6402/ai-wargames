import { NextRequest, NextResponse } from "next/server";
import { anthropicClient, createMessage, textOf } from "../../mercenary/model";

export const maxDuration = 30;

/** French and English of one highlighted line. */
export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim().slice(0, 400) : "";
  } catch {
    return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });
  }
  if (text.length < 2) return NextResponse.json({ error: "Highlight a little more." }, { status: 400 });

  const system = `You translate one short line for someone learning French. Reply with JSON only, no markdown: {"fr":"...","en":"..."}.
fr is the French. en is the English. If the line is already French, keep that French and put the English in en. If it is already English, keep that English and put the French in fr. Keep names. No notes.`;

  const response = await createMessage(client, {
    max_tokens: 300,
    system,
    messages: [{ role: "user", content: text }],
  });
  if ("error" in response) return NextResponse.json({ error: "The translation didn't come through." }, { status: 502 });

  const raw = textOf(response);
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? "";
  try {
    const parsed = JSON.parse(json) as { fr?: unknown; en?: unknown };
    const fr = typeof parsed.fr === "string" ? parsed.fr.trim().slice(0, 180) : "";
    const en = typeof parsed.en === "string" ? parsed.en.trim().slice(0, 180) : "";
    if (!fr || !en) return NextResponse.json({ error: "The translation didn't come through." }, { status: 502 });
    return NextResponse.json({ fr, en });
  } catch {
    return NextResponse.json({ error: "The translation didn't come through." }, { status: 502 });
  }
}
