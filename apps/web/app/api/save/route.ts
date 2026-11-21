import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getGameSave, resetGameSave, saveGameState } from "@/lib/db";
import { parseSave as parseSejourSave } from "@/app/sejour/lib/save";
import { parseSave as parseEpicerieSave } from "@/app/epicerie/lib/shop";

export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game");
  if (game !== "sejour" && game !== "epicerie") {
    return NextResponse.json({ error: "Invalid game parameter. Expected 'sejour' or 'epicerie'." }, { status: 400 });
  }

  const user = await getUserFromRequest(req);
  const data = await getGameSave(game, user?.id);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  let body: { game?: string; save?: unknown; event?: string; details?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  const { game, save, event, details } = body;
  if (game !== "sejour" && game !== "epicerie") {
    return NextResponse.json({ error: "Invalid game parameter. Expected 'sejour' or 'epicerie'." }, { status: 400 });
  }

  let validatedSave: unknown = null;
  if (game === "sejour") {
    validatedSave = parseSejourSave(save);
  } else if (game === "epicerie") {
    const raw = typeof save === "string" ? save : JSON.stringify(save);
    validatedSave = parseEpicerieSave(raw);
  }

  if (!validatedSave) {
    return NextResponse.json({ error: "Invalid save payload." }, { status: 400 });
  }

  const user = await getUserFromRequest(req);
  const result = await saveGameState(game, validatedSave, event, details, user?.id);
  return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
}

export async function DELETE(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game");
  if (game !== "sejour" && game !== "epicerie") {
    return NextResponse.json({ error: "Invalid game parameter. Expected 'sejour' or 'epicerie'." }, { status: 400 });
  }

  const user = await getUserFromRequest(req);
  await resetGameSave(game, user?.id);
  return NextResponse.json({ ok: true });
}
