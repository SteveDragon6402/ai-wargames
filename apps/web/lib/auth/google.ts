import crypto from "node:crypto";
import { getAppBaseUrl } from "@/lib/app-url";

export { getAppBaseUrl };

export interface OAuthStatePayload {
  nonce: string;
  verifier: string;
  inviteCode?: string;
  timezone?: string;
  next?: string;
}

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    "sejour-local-dev-secret-key"
  );
}

export function encodeOAuthStateCookie(payload: OAuthStatePayload): string {
  const json = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getSigningSecret()).update(json).digest("base64url");
  return `${json}.${sig}`;
}

export function decodeOAuthStateCookie(cookieVal: string | undefined): OAuthStatePayload | null {
  if (!cookieVal || !cookieVal.includes(".")) return null;
  const [json, sig] = cookieVal.split(".", 2);
  if (!json || !sig) return null;
  const expected = crypto.createHmac("sha256", getSigningSecret()).update(json).digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function buildGoogleAuthUrl(params: {
  origin: string;
  inviteCode?: string;
  timezone?: string;
  next?: string;
}): { url: string; stateCookieValue: string; stateNonce: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const baseUrl = getAppBaseUrl(params.origin);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const nonce = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  const stateCookieValue = encodeOAuthStateCookie({
    nonce,
    verifier,
    inviteCode: params.inviteCode,
    timezone: params.timezone,
    next: params.next,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  return { url: url.toString(), stateCookieValue, stateNonce: nonce };
}

export async function exchangeGoogleCodeForProfile(params: {
  code: string;
  verifier: string;
  origin: string;
}): Promise<{ email: string; name: string; picture?: string } | { error: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "Google OAuth is not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)." };
  }
  const baseUrl = getAppBaseUrl(params.origin);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: params.code,
        code_verifier: params.verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => "");
      return { error: `Google token exchange failed (${tokenRes.status}): ${detail.slice(0, 160)}` };
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    if (!tokenData.access_token) {
      return { error: "Google did not return an access token." };
    }

    const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      return { error: `Google userinfo failed (${userRes.status}).` };
    }
    const profile = (await userRes.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!profile.email) {
      return { error: "Google account did not provide an email address." };
    }
    return {
      email: profile.email.trim().toLowerCase(),
      name: profile.name?.trim() || profile.email.split("@")[0] || "Student",
      picture: profile.picture,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
