import { NextRequest, NextResponse } from "next/server";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

export const maxDuration = 30;

function formatForOrpheus(raw: string): string {
  return raw
    .replace(/\[(?:laughs|laugh)\]/gi, " <laugh> ")
    .replace(/\[(?:chuckles|chuckle|amused)\]/gi, " <chuckle> ")
    .replace(/\[(?:sighs|sigh)\]/gi, " <sigh> ")
    .replace(/\[(?:surprised|gasps|gasp)\]/gi, " <gasp> ")
    .replace(/\[(?:short pause|pause)\]/gi, " ... ")
    .replace(/\[[^\]]{1,64}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function refreshEnv(): void {
  try {
    loadDotenv({ path: resolve(process.cwd(), "../../.env"), override: true });
    loadDotenv({ path: resolve(process.cwd(), ".env"), override: true });
  } catch {
    // ignore if .env is not present
  }
}

/** Gérard's voice. Override with ELEVENLABS_VOICE_ID. */
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID?.trim() || "KatnlMuJ0yjp5AVO4Iza";
/** v3 is the model that performs the square-bracket delivery tags. */
const MODEL = "eleven_v3";

const cache = new Map<string, ArrayBuffer>();
const CACHE_MAX = 40;

function clip(bytes: ArrayBuffer, contentType = "audio/mpeg"): NextResponse {
  return new NextResponse(bytes, {
    headers: { "content-type": contentType, "cache-control": "private, max-age=3600" },
  });
}

async function requestGerardOrpheusFallback(rawText: string): Promise<NextResponse | null> {
  const orpheusUrl =
    process.env.ORPHEUS_API_URL?.trim() ||
    process.env.OPEN_TTS_URL?.trim() ||
    "http://127.0.0.1:5005/v1/audio/speech";
  const deepInfraKey = process.env.DEEPINFRA_API_KEY?.trim();

  const endpoint = orpheusUrl
    ? orpheusUrl.endsWith("/audio/speech") || orpheusUrl.endsWith("/tts")
      ? orpheusUrl
      : `${orpheusUrl.replace(/\/+$/, "")}/v1/audio/speech`
    : "https://api.deepinfra.com/v1/openai/audio/speech";

  const apiKey =
    process.env.ORPHEUS_API_KEY?.trim() ||
    process.env.HF_TOKEN?.trim() ||
    process.env.OPEN_TTS_API_KEY?.trim() ||
    deepInfraKey ||
    "local";
  const model =
    process.env.ORPHEUS_MODEL?.trim() ||
    process.env.OPEN_TTS_MODEL?.trim() ||
    (process.env.ORPHEUS_API_URL ? "canopylabs/3b-fr-ft-research_release" : "hexgrad/Kokoro-82M");
  const isOrpheus = /orpheus|3b-fr/i.test(model) || Boolean(process.env.ORPHEUS_API_URL);
  const voice = process.env.ORPHEUS_VOICE?.trim() || (isOrpheus ? "pierre" : "fm_france");
  const cleanText = isOrpheus
    ? formatForOrpheus(rawText) || rawText
    : rawText.replace(/\[[^\]]{1,64}\]/g, " ").replace(/\s+/g, " ").trim();

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: cleanText,
        prompt: `${voice}: ${cleanText}`,
        voice,
        response_format: "mp3",
      }),
    });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength) return null;
    return clip(bytes, res.headers.get("content-type") || "audio/mpeg");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  refreshEnv();
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  const preferOpen = Boolean(
    process.env.PREFER_ORPHEUS?.trim() || process.env.PREFER_OPEN_TTS?.trim(),
  );

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim().slice(0, 800) : "";
  } catch {
    return NextResponse.json({ error: "Say something." }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Say something." }, { status: 400 });

  if (preferOpen || !key) {
    const fallback = await requestGerardOrpheusFallback(text);
    if (fallback) return fallback;
    if (!key) return NextResponse.json({ error: "ElevenLabs is not configured." }, { status: 503 });
  }

  const cached = cache.get(text);
  if (cached) {
    cache.delete(text);
    cache.set(text, cached);
    return clip(cached);
  }

  let spoken: Response;
  try {
    spoken = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
  } catch {
    const fallback = await requestGerardOrpheusFallback(text);
    if (fallback) return fallback;
    return NextResponse.json({ error: "Gérard's voice didn't come through." }, { status: 502 });
  }
  if (!spoken.ok) {
    const fallback = await requestGerardOrpheusFallback(text);
    if (fallback) return fallback;
    return NextResponse.json({ error: "Gérard's voice didn't come through." }, { status: 502 });
  }

  const bytes = await spoken.arrayBuffer();
  cache.set(text, bytes);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return clip(bytes);
}
