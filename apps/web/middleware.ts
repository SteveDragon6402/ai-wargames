import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sejour_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/" ||
    pathname === "/join" ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/invite/") ||
    pathname.startsWith("/sejour/") ||
    pathname.startsWith("/epicerie/")
  ) {
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (sessionToken.length >= 16) {
    return NextResponse.next();
  }

  // Allow direct access to /sejour or /epicerie in local development if needed,
  // while protecting /home, /course/*, and /admin/* so login flow always works cleanly.
  if (
    process.env.NODE_ENV === "development" &&
    (pathname === "/sejour" || pathname === "/epicerie" || pathname.startsWith("/api/sejour") || pathname.startsWith("/api/epicerie") || pathname.startsWith("/api/save"))
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
