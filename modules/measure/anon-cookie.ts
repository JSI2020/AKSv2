import "server-only";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

const ANON_COOKIE = "aks_anon";
const ANON_HEADER = "x-aks-anon";
const MAX_AGE_S = 60 * 60 * 24 * 90;

/**
 * Guest cart / measure identity. Middleware sets the httpOnly cookie and
 * forwards the same value on `x-aks-anon` for the first request.
 */
export async function getOrSetAnonToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(ANON_COOKIE)?.value;
  if (existing) return existing;

  const hdr = await headers();
  const fromMiddleware = hdr.get(ANON_HEADER);
  if (fromMiddleware) return fromMiddleware;

  const token = randomBytes(24).toString("base64url");
  try {
    jar.set(ANON_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_S,
    });
  } catch {
    // Server Components cannot mutate cookies.
  }
  return token;
}

export async function readAnonToken(): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(ANON_COOKIE)?.value;
  if (existing) return existing;
  const hdr = await headers();
  return hdr.get(ANON_HEADER);
}
