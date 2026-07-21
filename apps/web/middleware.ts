import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./src/lib/session";

/**
 * Gate every page behind a session. This is a convenience redirect only — the
 * real authorization is the API, which rejects any request whose bearer does
 * not resolve. A forged web cookie buys nothing: the token still has to be a
 * live session the API recognises.
 */
export function middleware(req: NextRequest): NextResponse {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/login";

  if (!hasSession && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/inspections";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
