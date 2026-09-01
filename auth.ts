import NextAuth, { CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { eq } from "drizzle-orm";

import {
  accounts,
  db,
  sessions,
  users,
  verificationTokens,
} from "@aks/db";

import { authConfig } from "./auth.config";
import { findOrCreateCustomer } from "@/modules/auth/customer-account";
import {
  checkOtpVerifyRateLimit,
  clientIpFromHeaders,
  consumeEmailOtp,
  consumeRecoveryCode,
  createAuthSession,
  getActiveSession,
  logSignInAttempt,
  normalizeEmail,
  rolesRequiring2fa,
  adminTwoFactorEnforced,
  touchSession,
  verifyEmailOtp,
  verifyTotpForUser,
} from "@/modules/auth";

class TwoFactorRequired extends CredentialsSignin {
  code = "2FA_REQUIRED";
}

class OtpInvalid extends CredentialsSignin {
  code = "OTP_INVALID";
}

class AccountDisabled extends CredentialsSignin {
  code = "ACCOUNT_DISABLED";
}

class TwoFactorInvalid extends CredentialsSignin {
  code = "2FA_INVALID";
}

/**
 * OAuth providers are added only when their credentials exist, so an unset
 * environment simply has no Google/Facebook button rather than a broken one.
 * New sign-ins land as CUSTOMER (the users.role default); Auth.js will not link
 * an OAuth login to an existing email that has no matching account row
 * (OAuthAccountNotLinked), which keeps staff — who must use /admin/login and
 * its 2FA — from slipping in through the shop.
 */
function oauthProviders(): Provider[] {
  const list: Provider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    list.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }
  if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
    list.push(
      Facebook({
        clientId: process.env.AUTH_FACEBOOK_ID,
        clientSecret: process.env.AUTH_FACEBOOK_SECRET,
      }),
    );
  }
  return list;
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  // Credentials + JWT: adapter is available for account/user lookups; sessions are
  // written by createAuthSession (revocable rows with device/IP/lastSeenAt).
  adapter: DrizzleAdapter(db, {
    usersTable: users as never,
    accountsTable: accounts as never,
    sessionsTable: sessions as never,
    verificationTokensTable: verificationTokens as never,
  }),
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
      authorize: async (credentials, request) => {
        const emailRaw =
          typeof credentials?.email === "string" ? credentials.email : "";
        const otp =
          typeof credentials?.otp === "string" ? credentials.otp.trim() : "";
        const totp =
          typeof credentials?.totp === "string" ? credentials.totp.trim() : "";
        const recoveryCode =
          typeof credentials?.recoveryCode === "string"
            ? credentials.recoveryCode.trim()
            : "";

        const email = normalizeEmail(emailRaw);
        const ip = request ? clientIpFromHeaders(request.headers) : null;
        const userAgent = request?.headers.get("user-agent") ?? null;

        if (!email || !otp) {
          await logSignInAttempt({
            email: email || "unknown",
            ip,
            userAgent,
            success: false,
            reason: "missing_credentials",
          });
          throw new OtpInvalid();
        }

        const verifyLimit = await checkOtpVerifyRateLimit({
          email,
          reasons: ["otp_invalid", "2fa_invalid"],
        });
        if (!verifyLimit.ok) {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason: "otp_verify_locked",
          });
          throw new OtpInvalid();
        }

        const otpOk = await verifyEmailOtp({ email, code: otp });
        if (!otpOk) {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason: "otp_invalid",
          });
          throw new OtpInvalid();
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || user.deletedAt) {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason: "user_not_found",
          });
          throw new OtpInvalid();
        }

        if (user.status === "DISABLED") {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason: "account_disabled",
          });
          throw new AccountDisabled();
        }

        const twoFactorEnabled = !!user.twoFactorEnabledAt && !!user.twoFactorSecret;

        // 2FA is enforced in production; skipped in local/dev (see
        // adminTwoFactorEnforced) so the portal is reachable with just the code.
        if (twoFactorEnabled && adminTwoFactorEnforced()) {
          if (!totp && !recoveryCode) {
            throw new TwoFactorRequired();
          }

          let secondFactorOk = false;
          if (totp && user.twoFactorSecret) {
            secondFactorOk = await verifyTotpForUser({
              userId: user.id,
              encryptedSecret: user.twoFactorSecret,
              code: totp,
            });
          }
          if (!secondFactorOk && recoveryCode) {
            secondFactorOk = await consumeRecoveryCode({
              userId: user.id,
              code: recoveryCode,
            });
          }

          if (!secondFactorOk) {
            await logSignInAttempt({
              email,
              ip,
              userAgent,
              success: false,
              reason: "2fa_invalid",
            });
            throw new TwoFactorInvalid();
          }
        }

        await consumeEmailOtp(email);

        const session = await createAuthSession({
          userId: user.id,
          ip,
          userAgent,
        });

        const now = new Date();
        await db
          .update(users)
          .set({
            emailVerified: user.emailVerified ?? now,
            lastLoginAt: now,
            updatedAt: now,
            ...(user.status === "INVITED" ? { status: "ACTIVE" as const } : {}),
          })
          .where(eq(users.id, user.id));

        if (user.status === "INVITED") {
          const { staffInvites } = await import("@aks/db");
          const { and: andOp, eq: eqOp } = await import("drizzle-orm");
          await db
            .update(staffInvites)
            .set({
              status: "ACCEPTED",
              acceptedAt: now,
              updatedAt: now,
            })
            .where(
              andOp(
                eqOp(staffInvites.email, email),
                eqOp(staffInvites.status, "PENDING"),
              ),
            );
        }

        await logSignInAttempt({
          email,
          ip,
          userAgent,
          success: true,
          reason: "otp_success",
        });

        // Direct paths — avoid measure/cart barrels (they pull client modules / next/headers).
        const { readAnonToken } = await import("@/modules/measure/anon-cookie");
        const { mergeGuestCartIntoUser } = await import("@/modules/cart/merge");
        const anonId = await readAnonToken();
        if (anonId) {
          await mergeGuestCartIntoUser({ userId: user.id, anonId });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          twoFactorEnabled,
          requires2faEnrolment:
            rolesRequiring2fa(user.role) &&
            !twoFactorEnabled &&
            adminTwoFactorEnforced(),
          sessionId: session.id,
        };
      },
    }),
    // Storefront customer sign-in: email one-time code, self-provisioning on
    // first use. Separate from the staff "otp" provider on purpose — it creates
    // CUSTOMER accounts and carries no 2FA, so it must never sign in staff (the
    // findOrCreateCustomer guard enforces that).
    Credentials({
      id: "customer-otp",
      name: "Customer email code",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "Code", type: "text" },
      },
      authorize: async (credentials, request) => {
        const email = normalizeEmail(
          typeof credentials?.email === "string" ? credentials.email : "",
        );
        const otp =
          typeof credentials?.otp === "string" ? credentials.otp.trim() : "";
        const ip = request ? clientIpFromHeaders(request.headers) : null;
        const userAgent = request?.headers.get("user-agent") ?? null;

        if (!email || !otp) throw new OtpInvalid();

        const verifyLimit = await checkOtpVerifyRateLimit({
          email,
          reasons: ["otp_invalid"],
        });
        if (!verifyLimit.ok) {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason: "otp_verify_locked",
          });
          throw new OtpInvalid();
        }

        const otpOk = await verifyEmailOtp({ email, code: otp });
        if (!otpOk) {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason: "otp_invalid",
          });
          throw new OtpInvalid();
        }

        const resolved = await findOrCreateCustomer({ email, provider: "email" });
        if (!resolved.ok) {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason:
              resolved.reason === "staff" ? "customer_is_staff" : "account_disabled",
          });
          // Staff must use /admin/login (2FA); surface as disabled to the shop.
          throw new AccountDisabled();
        }

        await consumeEmailOtp(email);

        const session = await createAuthSession({
          userId: resolved.user.id,
          ip,
          userAgent,
        });

        await logSignInAttempt({
          email,
          ip,
          userAgent,
          success: true,
          reason: "otp_success",
        });

        const { readAnonToken } = await import("@/modules/measure/anon-cookie");
        const { mergeGuestCartIntoUser } = await import("@/modules/cart/merge");
        const anonId = await readAnonToken();
        if (anonId) {
          await mergeGuestCartIntoUser({ userId: resolved.user.id, anonId });
        }

        return {
          id: resolved.user.id,
          email: resolved.user.email,
          name: resolved.user.name,
          role: resolved.user.role,
          twoFactorEnabled: false,
          requires2faEnrolment: false,
          sessionId: session.id,
        };
      },
    }),
    ...oauthProviders(),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Defense in depth: never let an OAuth login resolve to a staff account,
      // even if email-linking were ever enabled. New customers have no role yet
      // at this point and pass through.
      if (account && account.provider !== "otp" && account.provider !== "customer-otp") {
        const role = (user as { role?: string }).role;
        if (role && role !== "CUSTOMER") return false;
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as { role?: string }).role;
        token.twoFactorEnabled = (
          user as { twoFactorEnabled?: boolean }
        ).twoFactorEnabled;
        token.requires2faEnrolment = (
          user as { requires2faEnrolment?: boolean }
        ).requires2faEnrolment;
        token.sessionId = (user as { sessionId?: string }).sessionId;
      }

      // OAuth first sign-in: the adapter created or matched a CUSTOMER user, but
      // no revocable session row exists yet (only the credentials providers make
      // one). Create it here so sign-out and the session list behave the same as
      // email sign-in, and pin the customer shape.
      if (
        user &&
        account &&
        account.provider !== "otp" &&
        account.provider !== "customer-otp" &&
        !token.sessionId
      ) {
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
        token.twoFactorEnabled = false;
        token.requires2faEnrolment = false;
        const oauthSession = await createAuthSession({
          userId: user.id as string,
        });
        token.sessionId = oauthSession.id;
      }

      if (trigger === "update" && session) {
        const s = session as {
          user?: {
            twoFactorEnabled?: boolean;
            requires2faEnrolment?: boolean;
          };
          twoFactorEnabled?: boolean;
          requires2faEnrolment?: boolean;
        };
        const enabled =
          s.user?.twoFactorEnabled ?? s.twoFactorEnabled;
        const requires =
          s.user?.requires2faEnrolment ?? s.requires2faEnrolment;
        if (typeof enabled === "boolean") {
          token.twoFactorEnabled = enabled;
          token.requires2faEnrolment = !enabled;
        }
        if (typeof requires === "boolean") {
          token.requires2faEnrolment = requires;
        }
      }

      if (token.sessionId && typeof token.sessionId === "string") {
        const active = await getActiveSession(token.sessionId);
        if (!active) {
          return null;
        }
        await touchSession(token.sessionId);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as string) ?? "CUSTOMER";
        session.user.twoFactorEnabled = Boolean(token.twoFactorEnabled);
        session.user.requires2faEnrolment = Boolean(token.requires2faEnrolment);
      }
      session.sessionId =
        typeof token.sessionId === "string" ? token.sessionId : "";
      return session;
    },
  },
});
