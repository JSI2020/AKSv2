import { cookies } from "next/headers";
import NextAuth, { CredentialsSignin } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import { and, eq } from "drizzle-orm";

import { accounts, db, sessions, users, verificationTokens } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { authConfig } from "./auth.config";
import {
  OAUTH_LINK_COOKIE,
  oauthLinkDecision,
  readOAuthLinkCookie,
} from "@/modules/account/oauth-link";
import { findOrCreateCustomer } from "@/modules/auth/customer-account";
import { configuredOAuthProviders } from "@/modules/auth/providers/oauth-providers";
import {
  ensureOAuthProfileEmail,
  isSocialOAuthProvider,
} from "@/modules/auth/social/identity";
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
  revokeSession,
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
 * Auth.js Drizzle adapter omits primary keys on insert. Our tables require
 * application UUIDv7 ids (no DB default), so wrap create/link.
 */
function aksAuthAdapter(): Adapter {
  const base = DrizzleAdapter(db, {
    usersTable: users as never,
    accountsTable: accounts as never,
    sessionsTable: sessions as never,
    verificationTokensTable: verificationTokens as never,
  });
  return {
    ...base,
    async createUser(data) {
      return base.createUser!({ ...data, id: uuidv7() });
    },
    async linkAccount(account) {
      await base.linkAccount!({
        ...account,
        id: uuidv7(),
      } as Parameters<NonNullable<Adapter["linkAccount"]>>[0]);
    },
  };
}

/**
 * A signed-in customer who starts Facebook, Instagram, TikTok, or Google from
 * the account page gets that provider attached to the open account.
 */
async function attachOAuthToSignedInCustomer(account: {
  provider: string;
  providerAccountId: string;
}): Promise<
  | { decision: "attach"; id: string; email: string; name: string | null }
  | { decision: "refuse" | "continue" }
> {
  let linkUserId: string | null = null;
  try {
    const jar = await cookies();
    linkUserId = readOAuthLinkCookie(
      jar.get(OAUTH_LINK_COOKIE)?.value,
      process.env.AUTH_SECRET?.trim() ?? "",
      Date.now(),
    );
  } catch {
    return { decision: "continue" };
  }
  if (!linkUserId) return { decision: "continue" };

  const [owner] = await db
    .select({
      id: users.id,
      role: users.role,
      status: users.status,
      deletedAt: users.deletedAt,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, linkUserId))
    .limit(1);
  const [existing] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, account.provider),
        eq(accounts.providerAccountId, account.providerAccountId),
      ),
    )
    .limit(1);
  const decision = oauthLinkDecision({
    linkUserId,
    owner: owner ?? null,
    existingAccountUserId: existing?.userId ?? null,
  });
  if (decision !== "attach" || !owner) {
    return { decision: decision === "attach" ? "refuse" : decision };
  }
  return {
    decision: "attach",
    id: owner.id,
    email: owner.email,
    name: owner.name,
  };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  // Credentials + JWT: adapter is available for account/user lookups; sessions are
  // written by createAuthSession (revocable rows with device/IP/lastSeenAt).
  adapter: aksAuthAdapter(),
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

        if (user.role === "CUSTOMER") {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason: "customer_on_staff_provider",
          });
          throw new OtpInvalid();
        }

        const twoFactorEnabled =
          !!user.twoFactorEnabledAt && !!user.twoFactorSecret;

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
        // Optional signup details — applied only when the account is created.
        name: { label: "Name", type: "text" },
        phone: { label: "WhatsApp", type: "text" },
        acceptsMarketing: { label: "Marketing opt-in", type: "text" },
      },
      authorize: async (credentials, request) => {
        const email = normalizeEmail(
          typeof credentials?.email === "string" ? credentials.email : "",
        );
        const otp =
          typeof credentials?.otp === "string" ? credentials.otp.trim() : "";
        const name =
          typeof credentials?.name === "string" ? credentials.name.trim() : "";
        const phone =
          typeof credentials?.phone === "string"
            ? credentials.phone.trim()
            : "";
        const acceptsMarketing = credentials?.acceptsMarketing === "true";
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

        const resolved = await findOrCreateCustomer({
          email,
          name: name || undefined,
          phone: phone || undefined,
          acceptsMarketing,
          provider: "email",
        });
        if (!resolved.ok) {
          await logSignInAttempt({
            email,
            ip,
            userAgent,
            success: false,
            reason:
              resolved.reason === "staff"
                ? "customer_is_staff"
                : "account_disabled",
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
    // Storefront customer sign-in by phone, with a code sent over WhatsApp.
    // Same self-provisioning and staff guard as the email flow, keyed on phone.
    Credentials({
      id: "customer-whatsapp",
      name: "Customer WhatsApp code",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        otp: { label: "Code", type: "text" },
      },
      authorize: async (credentials, request) => {
        const phoneRaw =
          typeof credentials?.phone === "string" ? credentials.phone : "";
        const otp =
          typeof credentials?.otp === "string" ? credentials.otp.trim() : "";
        const { toWhatsappMsisdn } = await import("@/modules/customers/phone");
        const phone = toWhatsappMsisdn(phoneRaw);
        const ip = request ? clientIpFromHeaders(request.headers) : null;
        const userAgent = request?.headers.get("user-agent") ?? null;
        const label = `wa:${phone}`;

        if (phone.length < 11 || !otp) throw new OtpInvalid();

        const verifyLimit = await checkOtpVerifyRateLimit({
          email: label,
          reasons: ["otp_invalid"],
        });
        if (!verifyLimit.ok) {
          await logSignInAttempt({
            email: label,
            ip,
            userAgent,
            success: false,
            reason: "otp_verify_locked",
          });
          throw new OtpInvalid();
        }

        const { verifyPhoneOtp, consumePhoneOtp } =
          await import("@/modules/auth/phone-otp");

        const otpOk = await verifyPhoneOtp({ phone, code: otp });
        if (!otpOk) {
          await logSignInAttempt({
            email: label,
            ip,
            userAgent,
            success: false,
            reason: "otp_invalid",
          });
          throw new OtpInvalid();
        }

        const resolved = await findOrCreateCustomer({
          phone,
          provider: "whatsapp",
        });
        if (!resolved.ok) {
          await logSignInAttempt({
            email: label,
            ip,
            userAgent,
            success: false,
            reason:
              resolved.reason === "staff"
                ? "customer_is_staff"
                : "account_disabled",
          });
          throw new AccountDisabled();
        }

        await consumePhoneOtp(phone);

        const session = await createAuthSession({
          userId: resolved.user.id,
          ip,
          userAgent,
        });

        await logSignInAttempt({
          email: label,
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
    ...configuredOAuthProviders(),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Storefront OAuth only. Runs before account link/create so we can refuse
      // staff emails before allowDangerousEmailAccountLinking attaches a provider.
      if (
        account &&
        account.provider !== "otp" &&
        account.provider !== "customer-otp" &&
        account.provider !== "customer-whatsapp"
      ) {
        if (isSocialOAuthProvider(account.provider)) {
          const linkedEmail = ensureOAuthProfileEmail({
            provider: account.provider,
            email: user.email,
            providerAccountId: account.providerAccountId,
          });
          if (!linkedEmail) return false;
          user.email = linkedEmail;
        }
        const email = user.email ? normalizeEmail(user.email) : null;
        if (email) {
          const [existing] = await db
            .select({
              role: users.role,
              status: users.status,
              deletedAt: users.deletedAt,
            })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          if (existing) {
            if (existing.deletedAt || existing.status === "DISABLED") {
              return false;
            }
            if (existing.role !== "CUSTOMER") {
              return false;
            }
          }
        }

        const role = (user as { role?: string }).role;
        if (role && role !== "CUSTOMER") return false;

        const linked = await attachOAuthToSignedInCustomer(account);
        if (linked.decision === "refuse") return false;
        if (linked.decision === "attach") {
          user.id = linked.id;
          user.email = linked.email;
          user.name = linked.name ?? user.name;
          return true;
        }

        const resolved = await findOrCreateCustomer({
          email: user.email,
          name: user.name ?? (profile as { name?: string } | undefined)?.name,
          provider: account.provider,
        });
        if (!resolved.ok) return false;

        user.id = resolved.user.id;
        (user as { role?: string }).role = resolved.user.role;
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
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

      // Never trust client-supplied 2FA flags — reload from DB.
      if (trigger === "update" && token.sub) {
        const [row] = await db
          .select({
            twoFactorEnabledAt: users.twoFactorEnabledAt,
            twoFactorSecret: users.twoFactorSecret,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);
        if (row) {
          const enabled = !!row.twoFactorEnabledAt && !!row.twoFactorSecret;
          token.twoFactorEnabled = enabled;
          token.requires2faEnrolment =
            rolesRequiring2fa(row.role) && !enabled && adminTwoFactorEnforced();
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
  events: {
    async signIn(message) {
      const user = message.user as {
        id?: string;
        email?: string | null;
        role?: string;
      };
      if (!user?.id) return;
      try {
        const { attachGuestOrdersForCustomer } =
          await import("@/modules/orders/attach-guest-orders");
        await attachGuestOrdersForCustomer({
          userId: user.id,
          email: user.email,
          role: user.role ?? "CUSTOMER",
        });
      } catch {
        // Non-fatal — order history can still match by guest email in queries.
      }
    },
    async signOut(message) {
      const sessionId =
        "token" in message &&
        message.token &&
        typeof message.token.sessionId === "string"
          ? message.token.sessionId
          : null;
      if (sessionId) {
        await revokeSession(sessionId);
      }
    },
  },
});
