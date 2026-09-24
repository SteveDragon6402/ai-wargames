import { NextRequest, NextResponse } from "next/server";
import { anthropicClient, createMessage, textOf } from "../../model";

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    doubleRest?: boolean;
    movement?: string;
    deed?: string;
    place?: string;
    ground?: string;
    kind?: string;
    hungerNote?: string;
    company?: string;
    watched?: boolean;
  } | null;
  if (!body?.place || !body.ground || !body.movement || !body.deed) {
    return NextResponse.json({ error: "The week is missing its place." }, { status: 400 });
  }

  const rest = body.doubleRest
    ? body.kind === "wild"
      ? "They did nothing but stay. There is no town. Write the company at rest on this ground. Say who is actually here."
      : "They did nothing but stay. No march, no drill, no purchase. They chill and mingle with the people of this place."
    : `Movement: ${body.movement}. Action: ${body.deed}. Write the week in two or three sentences.`;

  const response = await createMessage(client, {
    max_tokens: 300,
    system:
      "You write the scene of one week for a mercenary company. Two or three sentences. Do not invent a battle, a death, or a deed they did not do. Hunger, if mentioned, is true.",
    messages: [
      {
        role: "user",
        content: `${rest}
Place: ${body.place}. ${body.ground}
${body.watched ? "A band that knows this ground is still here." : ""}
Food: ${body.hungerNote || "They ate."}
${body.company || ""}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
  const scene = textOf(response);
  if (!scene) return NextResponse.json({ error: "The week came back empty." }, { status: 500 });
  return NextResponse.json({ scene });
}
