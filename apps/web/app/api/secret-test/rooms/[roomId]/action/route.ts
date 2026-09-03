import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { isFactionId } from "@/app/secret-test/types";
import { loadSecretRoom, saveState } from "@/app/secret-test/lib/store";
import { bothActionsIn } from "@/app/secret-test/lib/state";
import { validateActionText } from "@/app/secret-test/lib/words";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const invalid = validateActionText(text);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const loaded = await loadSecretRoom(roomId);
    if (!loaded) return NextResponse.json({ error: "The cipher is unknown." }, { status: 404 });

    const { room, roomPlayers, state } = loaded;
    if (room.status !== "playing") {
      return NextResponse.json({ error: "The war has not opened." }, { status: 400 });
    }
    if (!state) return NextResponse.json({ error: "Game state missing." }, { status: 500 });
    if (state.phase === "ended") {
      return NextResponse.json({ error: "The war is decided." }, { status: 400 });
    }
    if (state.phase !== "awaiting_actions") {
      return NextResponse.json({ error: "Couriers are still riding." }, { status: 400 });
    }

    const sessionToken = await getSessionToken();
    const viewer = sessionToken
      ? roomPlayers.find((p) => p.sessionToken === sessionToken)
      : null;
    if (!viewer || !isFactionId(viewer.factionId)) {
      return NextResponse.json({ error: "Your session is not in this council." }, { status: 403 });
    }

    if (state.pendingActions[viewer.factionId]?.trim()) {
      return NextResponse.json({ error: "Your riders have already gone." }, { status: 400 });
    }

    const next = {
      ...state,
      pendingActions: {
        ...state.pendingActions,
        [viewer.factionId]: text.trim(),
      },
    };

    if (bothActionsIn(next)) {
      next.phase = "resolving";
    }

    await saveState(roomId, next);
    return NextResponse.json({ ok: true, resolving: next.phase === "resolving" });
  } catch (e) {
    console.error("[POST /api/secret-test/rooms/[roomId]/action]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
