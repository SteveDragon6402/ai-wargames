import { NextRequest, NextResponse } from "next/server";
import { decodeOAuthStateCookie, exchangeGoogleCodeForProfile } from "@/lib/auth/google";
import { createSession, OAUTH_STATE_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { upsertUserWithInvite } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim() || "";
  const state = req.nextUrl.searchParams.get("state")?.trim() || "";
  const oauthError = req.nextUrl.searchParams.get("error")?.trim() || "";

  if (oauthError || !code) {
    const errUrl = new URL("/", req.url);
    errUrl.searchParams.set("error", oauthError || "Google sign-in was cancelled.");
    return NextResponse.redirect(errUrl);
  }

  const rawStateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const decodedState = decodeOAuthStateCookie(rawStateCookie);
  if (!decodedState || decodedState.nonce !== state) {
    const errUrl = new URL("/", req.url);
    errUrl.searchParams.set("error", "OAuth session expired. Please try signing in again.");
    return NextResponse.redirect(errUrl);
  }

  const profile = await exchangeGoogleCodeForProfile({
    code,
    verifier: decodedState.verifier,
    origin: req.nextUrl.origin,
  });

  if ("error" in profile) {
    const errUrl = new URL("/", req.url);
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
    const errUrl = new URL("/", req.url);
    errUrl.searchParams.set("error", upserted.error);
    errUrl.searchParams.set("needsInvite", "1");
    return NextResponse.redirect(errUrl);
  }

  const token = await createSession(upserted.user.id, req.headers.get("user-agent") ?? undefined);
  const dest = "/home";

  const res = NextResponse.redirect(new URL(dest, req.url));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
