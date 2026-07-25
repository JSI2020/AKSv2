import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const ANON_COOKIE = "aks_anon";
const MAX_AGE_S = 60 * 60 * 24 * 90;

export async function getOrSetAnonToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(ANON_COOKIE)?.value;
  if (existing) return existing;

  const token = randomBytes(24).toString("base64url");
  jar.set(ANON_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
  return token;
}

export async function readAnonToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ANON_COOKIE)?.value ?? null;
}
