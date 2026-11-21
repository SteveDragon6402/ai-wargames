import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { findUserById, getUserBundle, resetUserProgress, saveUserBundle } from "@/lib/db";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getUserFromRequest(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await context.params;
  const targetUser = await findUserById(id);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const bundle = await getUserBundle(targetUser.id, targetUser.timezone);
  return NextResponse.json({ user: targetUser, bundle });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getUserFromRequest(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; currentDay?: number };
  if (body.action === "reset") {
    await resetUserProgress(id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "set_day" && typeof body.currentDay === "number") {
    const targetUser = await findUserById(id);
    if (!targetUser) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const bundle = await getUserBundle(targetUser.id, targetUser.timezone);
    bundle.course.currentDay = Math.max(1, Math.min(28, Math.round(body.currentDay)));
    await saveUserBundle(targetUser.id, bundle);
    return NextResponse.json({ ok: true, course: bundle.course });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
