import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

/** v3 keeps the delivery tags. A full greeting used to take about 4.3s because the
 * file was held until it finished. The first sound arrives in about 0.6s, so this
 * route streams PCM and the client starts as soon as that arrives. */
const MODEL = "eleven_v3";

/** French-accented, and matched to age. Shared library voices, checked against the API. */
const VOICES: Record<string, string> = {
  gerard: "UBXZKOKbt62aLQHhc1Jm",
  rousseau: "EIdfNdxb4fnsE39tEAB1",
  announcer: "SLhJQg3VdZI7WdEazpYM",
  conductor: "enPZfpGclBAMBXlHv766",
  officer: "kmuUqyzoZLUXn7KeBkuY",
  serge: "pB0wYnYoA5t7xU302lqw",
  amina: "sQfOhaIRbFZ7R8bP1x9f",
  joel: "kiw9hkUW1gcPQwsQSs4e",
  lea: "txtf1EDouKke753vN8SL",
  marc: "ZLI7yULK3cOkcZl6GABN",
  ines: "FvmvwvObRqIHojkEGh5N",
  paul: "mN8UWPJNnmcExNpfrkd2",
  chloe: "xNtG3W2oqJs0cJZuTyBc",
  henri: "pB0wYnYoA5t7xU302lqw",
  monique: "Zi7dUK1wmV84QNPgB6Hc",
  yves: "w4FDa0ya9UrortMOEDXi",
  nadine: "BewlJwjEWiFLWoXrbGMf",
  luc: "K8nDX2f6wjv6bCh5UeZi",
};

const cache = new Map<string, ArrayBuffer>();

const PCM = { "content-type": "application/octet-stream", "x-sample-rate": "24000", "cache-control": "no-store" };

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "ElevenLabs is not configured." }, { status: 503 });

  let character = "";
  let text = "";
  try {
    const body = (await req.json()) as { character?: unknown; text?: unknown };
    character = typeof body.character === "string" ? body.character : "";
    text = typeof body.text === "string" ? body.text.trim().slice(0, 800) : "";
  } catch {
    return NextResponse.json({ error: "Say something." }, { status: 400 });
  }
  const voice = VOICES[character];
  if (!voice) return NextResponse.json({ error: "That voice isn't here." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Say something." }, { status: 400 });

  const cacheKey = `${character}:${text}`;
  const cached = cache.get(cacheKey);
  if (cached) return new NextResponse(cached, { headers: PCM });

  const spoken = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=pcm_24000`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!spoken.ok || !spoken.body) return NextResponse.json({ error: "The voice didn't come through." }, { status: 502 });

  const [toClient, toCache] = spoken.body.tee();
  void collect(toCache).then((bytes) => {
    if (!bytes.byteLength) return;
    cache.set(cacheKey, bytes);
    while (cache.size > 40) cache.delete(cache.keys().next().value as string);
  });
  return new NextResponse(toClient, { headers: PCM });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.length) continue;
    chunks.push(value);
    total += value.length;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}
