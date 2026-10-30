import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

/** Gérard's voice. Override with ELEVENLABS_VOICE_ID. */
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID?.trim() || "KatnlMuJ0yjp5AVO4Iza";
/** v3 is the model that performs the square-bracket delivery tags. */
const MODEL = "eleven_v3";

const cache = new Map<string, ArrayBuffer>();
const CACHE_MAX = 40;

function clip(bytes: ArrayBuffer): NextResponse {
  return new NextResponse(bytes, {
    headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600" },
  });
}

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "ElevenLabs is not configured." }, { status: 503 });

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim().slice(0, 800) : "";
  } catch {
    return NextResponse.json({ error: "Say something." }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Say something." }, { status: 400 });

  const cached = cache.get(text);
  if (cached) {
    cache.delete(text);
    cache.set(text, cached);
    return clip(cached);
  }

  const spoken = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!spoken.ok) return NextResponse.json({ error: "Gérard's voice didn't come through." }, { status: 502 });

  const bytes = await spoken.arrayBuffer();
  cache.set(text, bytes);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return clip(bytes);
}
