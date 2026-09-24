/**
 * Site-wide passphrase gate.
 *
 * The passphrase is stored only as a SHA-256 hash so it is not sitting in the
 * public repo. The session cookie is a hash of the server's Anthropic API key,
 * which is not in the repo either — knowing the hash is not enough to mint a
 * cookie. Set GATE_PASSWORD to replace the built-in passphrase.
 */

export const GATE_COOKIE = "wargame_gate";

const PASSPHRASE_SHA256 =
  "4e8ca93273eb9df9f4e1c3ff6262309049a4e75ff2d8fc0623d0eaf13a56b976";

const COOKIE_PREFIX = "wargame-gate-v1";

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/** Constant-time string compare. Length differences still fail closed. */
export function tokensMatch(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  const len = Math.max(left.length, right.length, 1);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export async function passwordMatches(input: string): Promise<boolean> {
  if (input.length === 0 || input.length > 200) return false;
  const override = process.env.GATE_PASSWORD?.trim();
  if (override) return tokensMatch(input, override);
  return tokensMatch(await sha256Hex(input), PASSPHRASE_SHA256);
}

/** Null when the server has no secret to sign a session with. */
export async function expectedGateCookie(): Promise<string | null> {
  const secret = process.env.ANTHROPIC_API_KEY?.trim();
  if (!secret) return null;
  return sha256Hex(`${COOKIE_PREFIX}:${secret}`);
}

export function gateCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

/** Only same-site paths. Drops protocol-relative and off-site targets. */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  if (value.includes("\\") || value.includes("://") || value.includes("\0")) {
    return "/";
  }
  if (value === "/gate" || value.startsWith("/gate?") || value.startsWith("/api/gate")) {
    return "/";
  }
  return value;
}
