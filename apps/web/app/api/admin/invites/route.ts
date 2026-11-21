import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { createInviteCode, listInvites, revokeInviteCode } from "@/lib/db";

async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const invites = await listInvites();
  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  let body: { code?: string; maxUses?: number; expiresInDays?: number | null; note?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const invite = await createInviteCode({
    code: body.code,
    createdBy: admin.email,
    maxUses: body.maxUses ?? 10,
    expiresInDays: body.expiresInDays ?? null,
    note: body.note ?? "",
  });

  return NextResponse.json({ ok: true, invite });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const ok = await revokeInviteCode(code);
  return NextResponse.json({ ok });
}
