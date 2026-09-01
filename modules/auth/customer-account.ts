import "server-only";

import { eq } from "drizzle-orm";

import { customerProfiles, db, users } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { crmPlaceholderEmail } from "@/modules/customers/phone";

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
  /** Where this sign-in came from — "email" | "google" | "facebook" | "whatsapp". */
  provider: string;
};

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
  const phone = identity.phone?.replace(/\D/g, "") || null;

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
      whatsappNumber: identity.provider === "whatsapp" ? phone : null,
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
