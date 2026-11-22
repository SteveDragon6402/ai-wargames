import { NextRequest, NextResponse } from "next/server";
import { appUrlFromRequest } from "@/lib/app-url";
import { decodeOAuthStateCookie, exchangeGoogleCodeForProfile, getAppBaseUrl } from "@/lib/auth/google";
import { createSession, OAUTH_STATE_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { upsertUserWithInvite } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim() || "";
  const state = req.nextUrl.searchParams.get("state")?.trim() || "";
  const oauthError = req.nextUrl.searchParams.get("error")?.trim() || "";

  if (oauthError || !code) {
    const errUrl = appUrlFromRequest(req, "/");
    errUrl.searchParams.set("error", oauthError || "Google sign-in was cancelled.");
    return NextResponse.redirect(errUrl);
  }

  const rawStateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const decodedState = decodeOAuthStateCookie(rawStateCookie);
  if (!decodedState || decodedState.nonce !== state) {
    const errUrl = appUrlFromRequest(req, "/");
    errUrl.searchParams.set("error", "OAuth session expired. Please try signing in again.");
    return NextResponse.redirect(errUrl);
  }

  const origin = getAppBaseUrl(req.nextUrl.origin, {
    host: req.headers.get("x-forwarded-host"),
    proto: req.headers.get("x-forwarded-proto"),
  });
  const profile = await exchangeGoogleCodeForProfile({
    code,
    verifier: decodedState.verifier,
    origin,
  });

  if ("error" in profile) {
    const errUrl = appUrlFromRequest(req, "/");
    errUrl.searchParams.set("error", profile.error);
    return NextResponse.redirect(errUrl);
  }

  const upserted = await upsertUserWithInvite({
    email: profile.email,
    name: profile.name,
    image: profile.picture,
    inviteCode: decodedState.inviteCode,
    timezone: decodedState.timezone,
  });

  if (!upserted.ok) {
    const errUrl = appUrlFromRequest(req, "/");
    errUrl.searchParams.set("error", upserted.error);
    errUrl.searchParams.set("needsInvite", "1");
    return NextResponse.redirect(errUrl);
  }

  const token = await createSession(upserted.user.id, req.headers.get("user-agent") ?? undefined);

  const res = NextResponse.redirect(appUrlFromRequest(req, "/home"));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
