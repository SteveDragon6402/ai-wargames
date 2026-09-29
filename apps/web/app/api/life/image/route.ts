import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const STYLE =
  "Painterly illustration of a medieval scene in Westeros. No text, no letters, no watermark, no modern objects, no photograph.";

export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json({ skipped: true });

  const body = (await req.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "The scene is missing." }, { status: 400 });

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: `${prompt.slice(0, 1800)} ${STYLE}`,
      size: "1024x1024",
      quality: "low",
      output_format: "jpeg",
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: { b64_json?: string; url?: string }[];
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    return NextResponse.json({ error: payload?.error?.message || "The picture was not made." }, { status: 502 });
  }
  const image = payload?.data?.[0];
  if (image?.b64_json) return NextResponse.json({ image: `data:image/jpeg;base64,${image.b64_json}` });
  if (image?.url) return NextResponse.json({ image: image.url });
  return NextResponse.json({ error: "The picture was not made." }, { status: 502 });
}
