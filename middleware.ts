import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

/**
 * Edge middleware — uses JWT session cookie only (no DB adapter).
 * Full auth (OTP authorize, session touch) lives in `auth.ts`.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*"],
};
