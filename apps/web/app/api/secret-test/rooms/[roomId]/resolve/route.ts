import { NextResponse } from "next/server";
import { GM_LOCK_MS } from "@/app/secret-test/types";
import { loadSecretRoom, saveState } from "@/app/secret-test/lib/store";
import { lockIsFresh, withLock } from "@/app/secret-test/lib/state";
import { runGmTurn } from "@/app/secret-test/lib/gm";

export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

  try {
    const loaded = await loadSecretRoom(roomId);
    if (!loaded) return NextResponse.json({ error: "The cipher is unknown." }, { status: 404 });

    const { room, roomPlayers, state } = loaded;
    if (room.status !== "playing") {
      return NextResponse.json({ error: "The war has not opened." }, { status: 400 });
    }
    if (!state) return NextResponse.json({ error: "Game state missing." }, { status: 500 });
    if (state.phase !== "resolving") {
      return NextResponse.json({ ok: true, skipped: true });
    }
    if (lockIsFresh(state, GM_LOCK_MS)) {
      return NextResponse.json({ ok: true, busy: true });
    }

    await saveState(roomId, withLock(state, true));

    try {
      const next = await runGmTurn({ ...state, gmLock: true }, roomPlayers);
      await saveState(roomId, withLock(next, false));
      return NextResponse.json({ ok: true, phase: next.phase, turn: next.turn });
    } catch (err) {
      console.error("[POST /api/secret-test/rooms/[roomId]/resolve] gm", err);
      await saveState(roomId, withLock(state, false));
      return NextResponse.json({ error: "The chronicler failed. Retry." }, { status: 500 });
    }
  } catch (e) {
    console.error("[POST /api/secret-test/rooms/[roomId]/resolve]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
