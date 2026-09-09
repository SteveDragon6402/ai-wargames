import { NextResponse } from "next/server";
import { isDebateMonth, isFactionId } from "@/app/secret-test/types";
import { resolveRoomViewer } from "@/app/secret-test/lib/identity";
import { loadSecretRoom, saveState } from "@/app/secret-test/lib/store";
import { bothActionsIn } from "@/app/secret-test/lib/state";
import { validateActionText, validateDebateAnswers } from "@/app/secret-test/lib/words";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

  let body: { text?: string; debateAnswers?: unknown };
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
    if (!loaded) return NextResponse.json({ error: "Unknown room." }, { status: 404 });

    const { room, roomPlayers, state } = loaded;
    if (room.status !== "playing") {
      return NextResponse.json({ error: "The campaign has not opened." }, { status: 400 });
    }
    if (!state) return NextResponse.json({ error: "Game state missing." }, { status: 500 });
    if (state.phase === "ended") {
      return NextResponse.json({ error: "The election is over." }, { status: 400 });
    }
    if (state.phase !== "awaiting_actions") {
      return NextResponse.json({ error: "Staff are still working last month's plan." }, { status: 400 });
    }

    const debateNeeded = isDebateMonth(state.month) ? state.debateQuestions.length || 3 : 0;
    const debateErr = validateDebateAnswers(body.debateAnswers, debateNeeded);
    if (debateErr) return NextResponse.json({ error: debateErr }, { status: 400 });

    const viewer = await resolveRoomViewer(roomPlayers);
    if (!viewer || !isFactionId(viewer.factionId)) {
      return NextResponse.json({ error: "Your session is not in this race." }, { status: 403 });
    }

    if (state.pendingActions[viewer.factionId]?.text?.trim()) {
      return NextResponse.json({ error: "This month's plan is already in." }, { status: 400 });
    }

    const next = {
      ...state,
      pendingActions: {
        ...state.pendingActions,
        [viewer.factionId]: {
          text: text.trim(),
          debateAnswers:
            debateNeeded > 0 && Array.isArray(body.debateAnswers)
              ? body.debateAnswers.map((a) => String(a).trim())
              : undefined,
        },
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
