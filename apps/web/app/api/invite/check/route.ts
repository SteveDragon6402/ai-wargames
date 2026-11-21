import { NextRequest, NextResponse } from "next/server";
import { validateInviteCode } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const result = await validateInviteCode(body.code ?? "");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    code: result.invite.code,
    note: result.invite.note,
    remainingUses: result.invite.maxUses - result.invite.uses,
  });
}
