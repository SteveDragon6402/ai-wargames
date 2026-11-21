import { NextRequest, NextResponse } from "next/server";
import { destroySession, getUserFromRequest, SESSION_COOKIE } from "@/lib/auth/session";
import { isGoogleOAuthConfigured } from "@/lib/auth/google";
import { getUserBundle } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({
      user: null,
      googleConfigured: isGoogleOAuthConfigured(),
    });
  }
  const bundle = await getUserBundle(user.id, user.timezone);
  return NextResponse.json({
    user,
    course: bundle.course,
    googleConfigured: isGoogleOAuthConfigured(),
  });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
