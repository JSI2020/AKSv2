import "server-only";

import { eq } from "drizzle-orm";

import { customerProfiles, db, users } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { crmPlaceholderEmail, toWhatsappMsisdn } from "@/modules/customers/phone";

import { normalizeEmail } from "./otp";

export type CustomerSignInResult =
  | { ok: true; user: CustomerUser; created: boolean }
  | { ok: false; reason: "disabled" | "staff" };

export type CustomerUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

type Identity = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  /** Opt-in captured at signup; only applied when the account is created. */
  acceptsMarketing?: boolean;
  /** Where this sign-in came from — "email" | "google" | "facebook" | "whatsapp". */
  provider: string;
};

function normalizePhoneForStorage(
  raw: string | null | undefined,
  provider: string,
): string | null {
  if (!raw) return null;
  if (provider === "whatsapp") {
    const msisdn = toWhatsappMsisdn(raw);
    return msisdn.length >= 11 ? msisdn : null;
  }
  const digits = raw.replace(/\D/g, "");
  return digits || null;
}

async function ensureCustomerProfile(
  userId: string,
  identity: Identity,
  phone: string | null,
): Promise<void> {
  const [profile] = await db
    .select({ userId: customerProfiles.userId })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    const now = new Date();
    await db.insert(customerProfiles).values({
      userId,
      whatsappNumber: identity.provider === "whatsapp" ? phone : null,
      source: identity.provider,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Resolve a storefront customer from a verified identity, creating the account
 * on first sign-in.
 *
 * A staff account is never signed in here: staff carry 2FA that the storefront
 * flow does not enforce, so letting a staff email through customer login would
 * be a way around it. Those are bounced to the staff portal instead. Disabled
 * or deleted accounts are refused outright.
 *
 * The caller is responsible for having already verified the identity (a
 * consumed OTP, a completed OAuth handshake) — this function trusts it.
 */
export async function findOrCreateCustomer(
  identity: Identity,
): Promise<CustomerSignInResult> {
  const email = identity.email ? normalizeEmail(identity.email) : null;
  const phone = normalizePhoneForStorage(identity.phone, identity.provider);

  const existing = email
    ? await db.select().from(users).where(eq(users.email, email)).limit(1)
    : phone
      ? await db.select().from(users).where(eq(users.phone, phone)).limit(1)
      : [];

  const found = existing[0];

  if (found) {
    if (found.deletedAt || found.status === "DISABLED") {
      return { ok: false, reason: "disabled" };
    }
    if (found.role !== "CUSTOMER") {
      return { ok: false, reason: "staff" };
    }

    const now = new Date();
    await db
      .update(users)
      .set({
        lastLoginAt: now,
        updatedAt: now,
        // First verified sign-in also confirms the address.
        emailVerified: found.emailVerified ?? (email ? now : found.emailVerified),
        // Backfill a phone captured by a later provider.
        phone: found.phone ?? phone,
      })
      .where(eq(users.id, found.id));

    await ensureCustomerProfile(found.id, identity, phone);

    return {
      ok: true,
      created: false,
      user: {
        id: found.id,
        email: found.email,
        name: found.name,
        role: found.role,
      },
    };
  }

  // email is NOT NULL. A phone-only sign-in (WhatsApp) gets the same synthesized
  // placeholder the CRM uses, which the read side treats as "no real email".
  const emailForRow = email ?? (phone ? crmPlaceholderEmail(phone) : null);
  if (!emailForRow) {
    return { ok: false, reason: "disabled" };
  }

  const userId = uuidv7();
  const now = new Date();
  const name =
    identity.name?.trim() ||
    (email ? email.split("@")[0] : null) ||
    (phone ? `Customer ${phone.slice(-4)}` : "Customer");

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email: emailForRow,
      name,
      phone,
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerified: email ? now : null,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(customerProfiles).values({
      userId,
      // The signup form's WhatsApp field arrives as phone for the email flow too.
      whatsappNumber: phone,
      acceptsMarketing: Boolean(identity.acceptsMarketing),
      source: identity.provider,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    ok: true,
    created: true,
    user: { id: userId, email, name, role: "CUSTOMER" },
  };
}
