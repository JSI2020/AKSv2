import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";

import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";

const { auth } = NextAuth(authConfig);
const intlMiddleware = createIntlMiddleware(routing);

export const ANON_COOKIE = "aks_anon";
export const ANON_HEADER = "x-aks-anon";
const ANON_MAX_AGE_S = 60 * 60 * 24 * 90;

function ensureAnonId(req: NextRequest): string {
  const fromCookie = req.cookies.get(ANON_COOKIE)?.value;
  if (fromCookie) return fromCookie;
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  ).slice(0, 32);
}

function withAnonRequest(req: NextRequest, anonId: string): NextRequest {
  const headers = new Headers(req.headers);
  headers.set(ANON_HEADER, anonId);
  return new NextRequest(req, { headers });
}

function stampAnonCookie(
  res: NextResponse,
  req: NextRequest,
  anonId: string,
): NextResponse {
  if (!req.cookies.get(ANON_COOKIE)?.value) {
    res.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ANON_MAX_AGE_S,
    });
  }
  return res;
}

/**
 * Admin: Auth.js JWT gate (matcher historically `/admin` only).
 * Storefront: next-intl locale prefix + RTL-ready routing.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const anonId = ensureAnonId(req);
  const reqWithAnon = withAnonRequest(req, anonId);

  if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return stampAnonCookie(NextResponse.next({
      request: { headers: reqWithAnon.headers },
    }), req, anonId);
  }

  return stampAnonCookie(intlMiddleware(reqWithAnon), req, anonId);
});

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
