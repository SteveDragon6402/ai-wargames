import { NextRequest, NextResponse } from "next/server";
import { anthropicClient, createMessage, textOf } from "../../model";

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    companyName?: string;
    payer?: string;
    place?: string;
    ground?: string;
    bandName?: string;
    leaderName?: string;
    purse?: number;
    payAt?: string;
    standing?: string;
  } | null;
  if (!body?.companyName || !body.place || !body.leaderName || !body.payAt) {
    return NextResponse.json({ error: "The offer is missing its place." }, { status: 400 });
  }

  const response = await createMessage(client, {
    max_tokens: 250,
    system:
      "You write the offer a court makes to a mercenary company. Two or three sentences, in the voice of the place. The purse, the band, and the ground are already decided. Do not change them. Do not invent a second job.",
    messages: [
      {
        role: "user",
        content: `${body.payer || "A court"} offers ${body.companyName} work against ${body.bandName || "a band"}, led by ${body.leaderName}, at ${body.place}. ${body.ground || ""}
The purse is ${body.purse ?? 0} coins, paid at ${body.payAt} when the band is gone.
How ${body.payer || "they"} regard the company: ${body.standing || "They are barely known."}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
  const offer = textOf(response);
  if (!offer) return NextResponse.json({ error: "The offer came back empty." }, { status: 500 });
  return NextResponse.json({ offer });
}
