import { eq } from "drizzle-orm";
import { getDb, rooms } from "@wargame/db";
import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  try {
    const db = getDb();
    const deleted = await db
      .delete(rooms)
      .where(eq(rooms.id, roomId))
      .returning({ id: rooms.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted[0]!.id });
  } catch (e) {
    console.error("[DELETE /api/admin/rooms/:id]", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
