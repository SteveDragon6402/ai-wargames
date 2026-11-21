import { NextRequest, NextResponse } from "next/server";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

export const maxDuration = 30;

function refreshEnv(): void {
  try {
    loadDotenv({ path: resolve(process.cwd(), "../../.env"), override: true });
    loadDotenv({ path: resolve(process.cwd(), ".env"), override: true });
  } catch {
    // ignore if .env is not present
  }
}

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
  martine: "Zi7dUK1wmV84QNPgB6Hc",
  pharmacien: "w4FDa0ya9UrortMOEDXi",
  camille: "FvmvwvObRqIHojkEGh5N",
  theo: "mN8UWPJNnmcExNpfrkd2",
  pistache: "kiw9hkUW1gcPQwsQSs4e",
  caissiere: "txtf1EDouKke753vN8SL",
};

const cache = new Map<string, ArrayBuffer>();

const PCM = { "content-type": "application/octet-stream", "x-sample-rate": "24000", "cache-control": "no-store" };

function stripAsteriskDirections(raw: string): string {
  return raw
    .replace(/\*[^*]{1,80}\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripBracketTagsForOpenTts(raw: string): string {
  return raw
    .replace(/\[[^\]]{1,64}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Orpheus TTS (`canopylabs/3b-fr-ft-research_release` / `Orpheus-3b-French-FT`)
 * natively understands `<laugh>`, `<chuckle>`, `<sigh>`, `<gasp>` tags in the text
 * and provides 3 French voices:
 * - `pierre` (male French)
 * - `amelie` (warm/mature female French)
 * - `marie`  (younger/spirited female French)
 */
const ORPHEUS_FR_VOICES: Record<string, "pierre" | "amelie" | "marie"> = {
  gerard: "pierre",
  rousseau: "amelie",
  announcer: "amelie",
  conductor: "pierre",
  officer: "pierre",
  serge: "pierre",
  amina: "marie",
  joel: "pierre",
  lea: "marie",
  marc: "pierre",
  ines: "marie",
  paul: "pierre",
  chloe: "marie",
  henri: "pierre",
  monique: "amelie",
  yves: "pierre",
  nadine: "amelie",
  luc: "pierre",
  martine: "amelie",
  pharmacien: "pierre",
  camille: "marie",
  theo: "pierre",
  pistache: "pierre",
  caissiere: "marie",
};

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

const FEMALE_CHARACTERS = new Set([
  "rousseau",
  "amina",
  "lea",
  "ines",
  "chloe",
  "monique",
  "nadine",
  "martine",
  "camille",
  "caissiere",
]);

/**
 * Requests speech from Orpheus TTS (`canopylabs/3b-fr-ft-research_release` via `ORPHEUS_API_URL`,
 * Orpheus-FastAPI, Hugging Face Inference Endpoint, Baseten, or OpenAI-compatible server).
 */
async function requestOrpheusTts(character: string, rawText: string): Promise<NextResponse | null> {
  const orpheusUrl = process.env.ORPHEUS_API_URL?.trim() || "http://127.0.0.1:5005/v1/audio/speech";
  const orpheusKey =
    process.env.ORPHEUS_API_KEY?.trim() ||
    process.env.HF_TOKEN?.trim() ||
    process.env.BASETEN_API_KEY?.trim() ||
    process.env.OPEN_TTS_API_KEY?.trim() ||
    "local";

  const endpoint =
    orpheusUrl.endsWith("/audio/speech") || orpheusUrl.endsWith("/tts")
      ? orpheusUrl
      : `${orpheusUrl.replace(/\/+$/, "")}/v1/audio/speech`;

  const model = process.env.ORPHEUS_MODEL?.trim() || "canopylabs/3b-fr-ft-research_release";
  const voice = process.env.ORPHEUS_VOICE?.trim() || ORPHEUS_FR_VOICES[character] || "amelie";
  const orpheusText = formatForOrpheus(rawText) || stripBracketTagsForOpenTts(rawText) || rawText;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${orpheusKey}`,
      },
      body: JSON.stringify({
        model,
        input: orpheusText,
        prompt: `${voice}: ${orpheusText}`,
        voice,
        response_format: "wav",
      }),
    });
    if (!res.ok || !res.body) return null;
    const contentType = res.headers.get("content-type") || "audio/wav";
    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength) return null;
    return new NextResponse(bytes, {
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  } catch {
    return null;
  }
}

/**
 * Optional open-weight neural TTS fallback:
 * 1. Tries Orpheus French (`ORPHEUS_API_URL` -> `canopylabs/3b-fr-ft-research_release` with `pierre` / `amelie` / `marie`)
 * 2. Tries generic OpenAI-compatible `/v1/audio/speech` (`OPEN_TTS_URL` or `DEEPINFRA_API_KEY` for Kyutai / Kokoro-82M `ff_siwis` / Orpheus)
 */
async function requestOpenWeightTts(character: string, rawText: string): Promise<NextResponse | null> {
  const orpheusResponse = await requestOrpheusTts(character, rawText);
  if (orpheusResponse) return orpheusResponse;

  const openUrl = process.env.OPEN_TTS_URL?.trim();
  const deepInfraKey = process.env.DEEPINFRA_API_KEY?.trim();
  if (!openUrl && !deepInfraKey) return null;

  const endpoint = openUrl
    ? openUrl.endsWith("/audio/speech")
      ? openUrl
      : `${openUrl.replace(/\/+$/, "")}/v1/audio/speech`
    : "https://api.deepinfra.com/v1/openai/audio/speech";
  const apiKey = process.env.OPEN_TTS_API_KEY?.trim() || deepInfraKey || "local";
  const model = process.env.OPEN_TTS_MODEL?.trim() || "hexgrad/Kokoro-82M";
  const isOrpheusModel = /orpheus/i.test(model);
  const voice =
    process.env.OPEN_TTS_VOICE?.trim() ||
    (isOrpheusModel
      ? ORPHEUS_FR_VOICES[character] || "amelie"
      : FEMALE_CHARACTERS.has(character)
        ? "ff_siwis"
        : "fm_france");
  const cleanText = isOrpheusModel
    ? formatForOrpheus(rawText) || rawText
    : stripBracketTagsForOpenTts(rawText) || rawText;

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
        voice,
        response_format: "mp3",
      }),
    });
    if (!res.ok || !res.body) return null;
    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength) return null;
    return new NextResponse(bytes, {
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
    });
  } catch {
    return null;
  }
}

async function requestElevenLabs(key: string, voice: string, spokenText: string): Promise<Response> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=pcm_24000`;
  const payload = JSON.stringify({
    text: spokenText,
    model_id: MODEL,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });
  const first = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: payload,
  });
  if (first.ok && first.body) return first;
  if (first.status === 429 || first.status >= 500) {
    await new Promise((r) => setTimeout(r, 350));
    return fetch(url, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: payload,
    });
  }
  return first;
}

export async function POST(req: NextRequest) {
  refreshEnv();
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  const preferOpen = Boolean(
    process.env.PREFER_ORPHEUS?.trim() || process.env.PREFER_OPEN_TTS?.trim(),
  );

  let character = "";
  let text = "";
  try {
    const body = (await req.json()) as { character?: unknown; text?: unknown };
    character = typeof body.character === "string" ? body.character : "";
    text = typeof body.text === "string" ? body.text.trim().slice(0, 800) : "";
  } catch {
    return NextResponse.json({ error: "Say something." }, { status: 400 });
  }
  const voice = VOICES[character] ?? VOICES.rousseau;
  const spokenText = stripAsteriskDirections(text) || text;
  if (!spokenText) return NextResponse.json({ error: "Say something." }, { status: 400 });

  if (preferOpen || !key) {
    const openFallback = await requestOpenWeightTts(character, spokenText);
    if (openFallback) return openFallback;
    if (!key) {
      return NextResponse.json({ error: "ElevenLabs is not configured." }, { status: 503 });
    }
  }

  const cacheKey = `${MODEL}:${character}:${spokenText}`;
  const cached = cache.get(cacheKey);
  if (cached) return new NextResponse(cached, { headers: PCM });

  let spoken: Response;
  try {
    spoken = await requestElevenLabs(key, voice, spokenText);
  } catch {
    const openFallback = await requestOpenWeightTts(character, spokenText);
    if (openFallback) return openFallback;
    return NextResponse.json({ error: "The voice didn't come through." }, { status: 502 });
  }
  if (!spoken.ok || !spoken.body) {
    const openFallback = await requestOpenWeightTts(character, spokenText);
    if (openFallback) return openFallback;
    const errText = await spoken.text().catch(() => "");
    console.error("[sejour/voice] ElevenLabs error:", spoken.status, errText);
    return NextResponse.json({ error: "The voice didn't come through.", status: spoken.status, detail: errText }, { status: 502 });
  }

  const [toClient, toCache] = spoken.body.tee();
  void collect(toCache)
    .then((bytes) => {
      if (!bytes.byteLength) return;
      cache.set(cacheKey, bytes);
      while (cache.size > 60) cache.delete(cache.keys().next().value as string);
    })
    .catch(() => {});
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
