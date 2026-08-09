import NextAuth, { CredentialsSignin } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import {
  accounts,
  db,
  sessions,
  users,
  verificationTokens,
} from "@aks/db";

import { authConfig } from "./auth.config";
import {
  clientIpFromHeaders,
  consumeEmailOtp,
  consumeRecoveryCode,
  createAuthSession,
  getActiveSession,
  logSignInAttempt,
  normalizeEmail,
  rolesRequiring2fa,
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

        if (twoFactorEnabled) {
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
            rolesRequiring2fa(user.role) && !twoFactorEnabled,
          sessionId: session.id,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
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
