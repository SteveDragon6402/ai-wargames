import { NextRequest, NextResponse } from "next/server";
import { anthropicClient, createMessage, textOf } from "../../model";

function twoLines(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
  return lines.slice(0, 2).join("\n");
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    place?: string;
    ground?: string;
    kind?: string;
    stayed?: boolean;
    weeks?: number;
    previous?: string | null;
    movement?: string;
    deed?: string;
    men?: number;
    notice?: string;
  } | null;
  if (!body?.place || !body.ground) return NextResponse.json({ error: "The place is missing." }, { status: 400 });

  const stay = body.stayed
    ? `They stayed. This is week ${body.weeks ?? 1} in the same place without a march. A short stay can mean the people are glad of the swords. A long stay means crowded houses, empty barns, and people who want them gone. Write which one this is.`
    : "They have just arrived, or they marched in this week. Write the arrival. Do not carry over the life of another place.";

  const response = await createMessage(client, {
    max_tokens: 400,
    system:
      "You rewrite how a mercenary company is living in one place. Two lines, no more, the best of how they are living there. Each line is one sentence. Nothing is neutral: say whether this place is glad of them, wary of them, or wants them gone, and why. Do not invent a battle, a death, or a deed that is not in the week.",
    messages: [
      {
        role: "user",
        content: `Place: ${body.place}. ${body.ground} Kind: ${body.kind ?? "place"}.
${stay}
Movement: ${body.movement ?? "They stayed."}
Deed: ${body.deed ?? "They rested."}
${body.notice ? `Also true: ${body.notice}` : ""}
${body.men ?? 0} men are eating and being paid here.
${body.previous?.trim() ? `What was written last week, which you may rewrite, drop, or keep:\n${body.previous.trim()}` : "There is no earlier portrait of this stay."}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
  const portrait = twoLines(textOf(response));
  if (!portrait) return NextResponse.json({ error: "The place was not written." }, { status: 500 });
  return NextResponse.json({ portrait });
}
