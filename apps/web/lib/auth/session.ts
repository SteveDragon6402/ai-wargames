import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { findUserById, readDatabase, writeDatabase, type UserRecord } from "@/lib/db";

export const SESSION_COOKIE = "sejour_session";
export const OAUTH_STATE_COOKIE = "sejour_oauth_state";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days ("remember me on this browser")

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/" as const,
    maxAge,
  };
}

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const id = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

  const db = await readDatabase();
  db.sessions![id] = {
    id,
    userId,
    expiresAt,
    createdAt: now.toISOString(),
    userAgent: userAgent?.slice(0, 200),
  };
  await writeDatabase(db);
  return rawToken;
}

export async function getUserBySessionToken(rawToken: string | undefined | null): Promise<UserRecord | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const id = hashToken(rawToken);
  const db = await readDatabase();
  const session = db.sessions?.[id];
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    delete db.sessions![id];
    await writeDatabase(db);
    return null;
  }
  const user = await findUserById(session.userId);
  return user;
}

export async function getUserFromRequest(req: NextRequest): Promise<UserRecord | null> {
  const rawToken = req.cookies.get(SESSION_COOKIE)?.value;
  return getUserBySessionToken(rawToken);
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  try {
    const store = await cookies();
    const rawToken = store.get(SESSION_COOKIE)?.value;
    return getUserBySessionToken(rawToken);
  } catch {
    return null;
  }
}

export async function destroySession(rawToken: string | undefined | null): Promise<void> {
  if (!rawToken) return;
  const id = hashToken(rawToken);
  const db = await readDatabase();
  if (db.sessions?.[id]) {
    delete db.sessions[id];
    await writeDatabase(db);
  }
}
