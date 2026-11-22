import { NextRequest, NextResponse } from "next/server";
import { appUrlFromRequest } from "@/lib/app-url";
import { buildGoogleAuthUrl, getAppBaseUrl, isGoogleOAuthConfigured } from "@/lib/auth/google";
import { OAUTH_STATE_COOKIE } from "@/lib/auth/session";
import { validateInviteCode } from "@/lib/db";

export async function GET(req: NextRequest) {
  const inviteCode =
    req.nextUrl.searchParams.get("inviteCode")?.trim() ||
    req.nextUrl.searchParams.get("invite")?.trim() ||
    "";
  const timezone = req.nextUrl.searchParams.get("tz")?.trim() || "Europe/Paris";
  const next = req.nextUrl.searchParams.get("next")?.trim() || "/home";

  if (inviteCode) {
    const check = await validateInviteCode(inviteCode);
    if (!check.ok) {
      const errUrl = appUrlFromRequest(req, "/");
      errUrl.searchParams.set("error", check.error);
      return NextResponse.redirect(errUrl);
    }
  }

  if (!isGoogleOAuthConfigured()) {
    const errUrl = appUrlFromRequest(req, "/");
    errUrl.searchParams.set(
      "error",
      "Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured in .env yet. Use the Email + Invite Code sign-in below!",
    );
    return NextResponse.redirect(errUrl);
  }

  const { url, stateCookieValue } = buildGoogleAuthUrl({
    origin: getAppBaseUrl(req.nextUrl.origin, {
      host: req.headers.get("x-forwarded-host"),
      proto: req.headers.get("x-forwarded-proto"),
    }),
    inviteCode,
    timezone,
    next,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, stateCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
