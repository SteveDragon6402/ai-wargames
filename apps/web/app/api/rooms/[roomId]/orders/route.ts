import { and, eq } from "drizzle-orm";
import { validateCommand } from "@wargame/engine";
import { GameGraph } from "@wargame/engine";
import { games, getDb, orders, rooms } from "@wargame/db";
import type { Command, FactionId } from "@wargame/shared";
import { upsertOrderSchema } from "@wargame/shared";
import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/player";
import { factionForOrderValidation } from "@/lib/solo-mode";

function unitIdForCommand(command: Command): string {
  return command.unitId;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const player = await getCurrentPlayer(roomId);
  if (!player) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = upsertOrderSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room || room.status !== "playing") {
    return NextResponse.json({ error: "Game not in progress" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.roomId, roomId)).limit(1);
  if (!game || game.phase !== "planning") {
    return NextResponse.json({ error: "Not in planning phase" }, { status: 400 });
  }

  const readyIds: string[] = Array.isArray(game.readyPlayerIds) ? game.readyPlayerIds : [];
  if (readyIds.includes(player.id)) {
    return NextResponse.json({ error: "Orders locked after submission" }, { status: 403 });
  }

  const command = body.data.command;
  const graph = new GameGraph(game.state.map);
  const validateAs = room.soloDualFaction
    ? factionForOrderValidation(game.state, command, player.factionId as FactionId)
    : (player.factionId as FactionId);
  try {
    validateCommand(game.state, graph, validateAs, command);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid command";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const unitId = unitIdForCommand(command);

  await db
    .delete(orders)
    .where(
      and(
        eq(orders.roomId, roomId),
        eq(orders.turn, game.turn),
        eq(orders.unitId, unitId)
      )
    );

  await db.insert(orders).values({
    roomId,
    turn: game.turn,
    playerId: player.id,
    unitId,
    command,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const player = await getCurrentPlayer(roomId);
  if (!player) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");
  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const db = getDb();
  const [game] = await db.select().from(games).where(eq(games.roomId, roomId)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "No game" }, { status: 404 });
  }

  const readyIds: string[] = Array.isArray(game.readyPlayerIds) ? game.readyPlayerIds : [];
  if (readyIds.includes(player.id)) {
    return NextResponse.json({ error: "Orders locked after submission" }, { status: 403 });
  }

  await db
    .delete(orders)
    .where(
      and(
        eq(orders.roomId, roomId),
        eq(orders.turn, game.turn),
        eq(orders.playerId, player.id),
        eq(orders.unitId, unitId)
      )
    );

  return NextResponse.json({ ok: true });
}
