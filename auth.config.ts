import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import {
  isProductionOnlyRole,
  isTailorAllowedPath,
} from "@/modules/auth/tailor-access";

/** Edge-safe mirror of {@link adminTwoFactorEnforced} — no DB imports. */
function adminTwoFactorEnforced(): boolean {
  if (process.env.AKS_ENFORCE_ADMIN_2FA === "1") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Edge-safe Auth.js config (no DB adapter / Node crypto).
 * Shared by middleware and the full `auth.ts` config.
 */
export const authConfig = {
  providers: [
    Credentials({
      id: "otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "OTP", type: "text" },
        totp: { label: "Authenticator code", type: "text" },
        recoveryCode: { label: "Recovery code", type: "text" },
      },
      // authorize is implemented in auth.ts (Node runtime) via provider override —
      // this stub satisfies the config shape for the edge bundle.
      authorize: async () => null,
    }),
    Credentials({
      id: "customer-otp",
      name: "Customer email code",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "Code", type: "text" },
      },
      // Real authorize lives in auth.ts (Node runtime); this stub keeps the
      // edge bundle's provider shape in sync.
      authorize: async () => null,
    }),
  ],
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = !!auth?.user;

      if (path.startsWith("/admin/login")) {
        // Never auto-bounce to /admin — stale JWT cookies (e.g. after db:wipe)
        // loop forever with the protected layout sign-in redirect.
        return true;
      }

      if (path.startsWith("/admin/2fa")) {
        return isLoggedIn;
      }

      if (path.startsWith("/admin")) {
        if (!isLoggedIn) return false;
        const role = (auth.user as { role?: string }).role;
        const twoFactorEnabled = (auth.user as { twoFactorEnabled?: boolean })
          .twoFactorEnabled;
        if (
          adminTwoFactorEnforced() &&
          (role === "OWNER" || role === "ADMIN") &&
          !twoFactorEnabled &&
          !path.startsWith("/admin/2fa")
        ) {
          return Response.redirect(new URL("/admin/2fa", request.nextUrl));
        }
        if (isProductionOnlyRole(role)) {
          if (path === "/admin" || path === "/admin/") {
            return Response.redirect(
              new URL("/admin/production", request.nextUrl),
            );
          }
          if (!isTailorAllowedPath(path)) {
            return Response.redirect(
              new URL("/admin/production", request.nextUrl),
            );
          }
        }
        return true;
      }

      return true;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
