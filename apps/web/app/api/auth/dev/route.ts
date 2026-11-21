import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { upsertUserWithInvite } from "@/lib/db";

/**
 * Direct Email + Invite Code sign-in (or Admin sign-in with ADMIN_PASSWORD),
 * so users & admins can sign in even before Google OAuth credentials are set up,
 * and stay remembered for 90 days on the same browser.
 */
export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    name?: string;
    inviteCode?: string;
    adminPassword?: string;
    timezone?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const inviteCode = (body.inviteCode ?? "").trim().toUpperCase();
  const adminPassword = (body.adminPassword ?? "").trim();
  const timezone = (body.timezone ?? "Europe/Paris").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  let forceAdmin = false;
  if (adminPassword) {
    const expectedAdmin = process.env.ADMIN_PASSWORD?.trim() || process.env.APP_PASSWORD?.trim() || "admin";
    if (adminPassword !== expectedAdmin) {
      return NextResponse.json({ error: "Incorrect admin password." }, { status: 403 });
    }
    forceAdmin = true;
  }

  const upserted = await upsertUserWithInvite({
    email,
    name: name || email.split("@")[0] || "Student",
    inviteCode,
    timezone,
    forceAdmin,
  });

  if (!upserted.ok) {
    return NextResponse.json({ error: upserted.error, needsInvite: true }, { status: 403 });
  }

  const token = await createSession(upserted.user.id, req.headers.get("user-agent") ?? undefined);
  const redirectTo = "/home";

  const res = NextResponse.json({
    ok: true,
    user: upserted.user,
    isNew: upserted.isNew,
    redirectTo,
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
