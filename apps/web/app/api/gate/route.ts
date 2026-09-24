import { NextResponse } from "next/server";
import {
  GATE_COOKIE,
  expectedGateCookie,
  gateCookieOptions,
  passwordMatches,
  safeNext,
} from "@/lib/gate-auth";

export async function POST(req: Request) {
  let password = "";
  let next = "";
  const type = req.headers.get("content-type") ?? "";

  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as {
      password?: unknown;
      next?: unknown;
    } | null;
    password = typeof body?.password === "string" ? body.password : "";
    next = typeof body?.next === "string" ? body.next : "";
  } else {
    const form = await req.formData();
    const rawPassword = form.get("password");
    const rawNext = form.get("next");
    password = typeof rawPassword === "string" ? rawPassword : "";
    next = typeof rawNext === "string" ? rawNext : "";
  }

  const dest = safeNext(next);
  const session = await expectedGateCookie();
  const ok = session !== null && (await passwordMatches(password));

  if (!ok) {
    const back = new URL("/gate", req.url);
    back.searchParams.set("error", session ? "1" : "config");
    if (dest !== "/") back.searchParams.set("next", dest);
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(dest, req.url), 303);
  res.cookies.set(GATE_COOKIE, session, gateCookieOptions());
  return res;
}
