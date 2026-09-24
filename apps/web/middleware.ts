import { NextResponse, type NextRequest } from "next/server";
import {
  GATE_COOKIE,
  expectedGateCookie,
  safeNext,
  tokensMatch,
} from "@/lib/gate-auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/api/health") return NextResponse.next();

  const expected = await expectedGateCookie();
  const presented = req.cookies.get(GATE_COOKIE)?.value ?? "";
  const authed =
    expected !== null && presented.length > 0 && tokensMatch(presented, expected);

  if (pathname === "/api/gate") return NextResponse.next();

  if (pathname === "/gate") {
    if (!authed) return NextResponse.next();
    const dest = safeNext(req.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  const next = `${pathname}${req.nextUrl.search}`;
  url.pathname = "/gate";
  url.search = "";
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
