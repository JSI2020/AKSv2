import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

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
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin", request.nextUrl));
        }
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
          (role === "OWNER" || role === "ADMIN") &&
          !twoFactorEnabled &&
          !path.startsWith("/admin/2fa")
        ) {
          return Response.redirect(new URL("/admin/2fa", request.nextUrl));
        }
        return true;
      }

      return true;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
