import { NextRequest, NextResponse } from "next/server";
import { composeImagePrompt, type PictureFrame } from "../../../life/lib/picture";

export const maxDuration = 60;

const MODELS = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"];

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

function frameOf(value: unknown): PictureFrame {
  if (value === "place" || value === "figure") return value;
  if (value === 1 || value === "1") return "place";
  return "figure";
}

function imageFrom(payload: {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  error?: { message?: string };
}): { image?: string; error?: string } {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    const data = inline?.data;
    const mime =
      (inline && "mimeType" in inline ? inline.mimeType : undefined) ??
      (inline && "mime_type" in inline ? inline.mime_type : undefined) ??
      "image/png";
    if (data) return { image: `data:${mime};base64,${data}` };
  }
  return { error: payload.error?.message || "The picture was not made." };
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) return NextResponse.json({ skipped: true });

  const body = (await req.json().catch(() => null)) as { prompt?: unknown; frame?: unknown; index?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "The scene is missing." }, { status: 400 });
  const frame = frameOf(body?.frame ?? body?.index);
  const full = composeImagePrompt(prompt, frame);

  let last = "The picture was not made.";
  for (const model of MODELS) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: full }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: frame === "figure" ? "4:5" : "3:2" },
        },
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
      error?: { message?: string };
    } | null;
    if (!payload) {
      last = "The picture was not made.";
      continue;
    }
    const made = imageFrom(payload);
    if (response.ok && made.image) return NextResponse.json({ image: made.image });
    last = made.error || last;
    if (response.status === 401 || response.status === 403) break;
  }
  return NextResponse.json({ error: last }, { status: 502 });
}
