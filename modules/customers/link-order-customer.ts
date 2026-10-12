import { and, eq, isNull, sql } from "drizzle-orm";

import {
  addresses,
  customerProfiles,
  db,
  insertAuditLog,
  orders,
  users,
  type Database,
  type ShippingAddressSnapshot,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import type { DbTx } from "@/modules/platform/types";

import { crmPlaceholderEmail, normalizePhoneDigits } from "./phone";

type LinkInput = {
  existingUserId?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  source?: string | null;
  address?: ShippingAddressSnapshot | null;
};

function cleanEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return email;
}

async function findCustomerId(
  tx: DbTx,
  input: { userId?: string | null; email?: string | null; phoneDigits: string },
): Promise<string | null> {
  if (input.userId) {
    const [byId] = await tx
      .select({ id: users.id, role: users.role, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (byId && byId.role === "CUSTOMER" && !byId.deletedAt) return byId.id;
  }

  if (input.email) {
    const [byEmail] = await tx
      .select({ id: users.id, role: users.role, deletedAt: users.deletedAt })
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`)
      .limit(1);
    if (byEmail && byEmail.role === "CUSTOMER" && !byEmail.deletedAt) {
      return byEmail.id;
    }
  }

  if (input.phoneDigits.length >= 10) {
    const [byPhone] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "CUSTOMER"),
          isNull(users.deletedAt),
          eq(users.phone, input.phoneDigits),
        ),
      )
      .limit(1);
    if (byPhone) return byPhone.id;

    const [byWhatsapp] = await tx
      .select({ userId: customerProfiles.userId })
      .from(customerProfiles)
      .innerJoin(users, eq(users.id, customerProfiles.userId))
      .where(
        and(
          eq(customerProfiles.whatsappNumber, input.phoneDigits),
          isNull(customerProfiles.mergedIntoUserId),
          eq(users.role, "CUSTOMER"),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (byWhatsapp) return byWhatsapp.userId;
  }

  return null;
}

async function ensureProfile(
  tx: DbTx,
  userId: string,
  fields: { whatsappNumber: string | null; source: string | null },
) {
  const [existing] = await tx
    .select({
      userId: customerProfiles.userId,
      whatsappNumber: customerProfiles.whatsappNumber,
      source: customerProfiles.source,
    })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  const now = new Date();
  if (existing) {
    if (!existing.whatsappNumber && fields.whatsappNumber) {
      await tx
        .update(customerProfiles)
        .set({
          whatsappNumber: fields.whatsappNumber,
          source: existing.source ?? fields.source,
          updatedAt: now,
        })
        .where(eq(customerProfiles.userId, userId));
    }
    return;
  }

  await tx.insert(customerProfiles).values({
    userId,
    whatsappNumber: fields.whatsappNumber,
    source: fields.source,
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureAddress(
  tx: DbTx,
  userId: string,
  address: ShippingAddressSnapshot | null | undefined,
) {
  if (!address?.addressLine1 || !address.city || !address.recipientName) return;

  const [existing] = await tx
    .select({ id: addresses.id })
    .from(addresses)
    .where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt)))
    .limit(1);
  if (existing) return;

  const now = new Date();
  await tx.insert(addresses).values({
    id: uuidv7(),
    userId,
    label: "Shipping",
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? null,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode ?? null,
    landmark: address.landmark ?? null,
    isDefaultShipping: true,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Find or create the CUSTOMER behind a checkout or manual order.
 * Staff accounts are never reused. Email and phone are the match keys.
 */
export async function linkOrderCustomer(
  tx: DbTx,
  input: LinkInput,
): Promise<string | null> {
  const email = cleanEmail(input.email);
  const phoneDigits =
    normalizePhoneDigits(input.phone ?? "") ||
    normalizePhoneDigits(input.whatsappNumber ?? "");
  const whatsappDigits =
    normalizePhoneDigits(input.whatsappNumber ?? "") || phoneDigits || null;

  const existing = await findCustomerId(tx, {
    userId: input.existingUserId,
    email,
    phoneDigits,
  });

  let userId = existing;
  if (!userId) {
    const [emailOwner] = email
      ? await tx
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.email}) = ${email}`)
          .limit(1)
      : [];

    const insertEmail = emailOwner
      ? phoneDigits.length >= 10
        ? crmPlaceholderEmail(phoneDigits)
        : null
      : email;

    if (!insertEmail) return null;

    userId = uuidv7();
    const now = new Date();
    await tx.insert(users).values({
      id: userId,
      email: insertEmail,
      name: input.name?.trim() || null,
      phone: phoneDigits.length >= 10 ? phoneDigits : null,
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerified: null,
      createdAt: now,
      updatedAt: now,
    });
  } else if (phoneDigits.length >= 10) {
    const [current] = await tx
      .select({ phone: users.phone, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (current && (!current.phone || !current.name)) {
      await tx
        .update(users)
        .set({
          phone: current.phone || phoneDigits,
          name: current.name || input.name?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }
  }

  await ensureProfile(tx, userId, {
    whatsappNumber: whatsappDigits,
    source: input.source ?? null,
  });
  await ensureAddress(tx, userId, input.address);
  return userId;
}

/** Attach guest orders that never received a customer record. Skips drafts. */
export async function linkUnassignedOrders(actor: {
  id: string;
  role: string;
}): Promise<number> {
  const rows = await db
    .select({
      id: orders.id,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      whatsappNumber: orders.whatsappNumber,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
      source: orders.source,
    })
    .from(orders)
    .where(and(isNull(orders.userId), sql`${orders.status} <> 'DRAFT'`));

  if (rows.length === 0) return 0;

  let linked = 0;
  for (const row of rows) {
    try {
      const didLink = await db.transaction(async (tx) => {
        const userId = await linkOrderCustomer(tx, {
          email: row.guestEmail,
          name: row.shippingAddressSnapshot?.recipientName ?? null,
          phone: row.guestPhone || row.shippingAddressSnapshot?.phone || null,
          whatsappNumber:
            row.whatsappNumber ||
            row.guestPhone ||
            row.shippingAddressSnapshot?.phone ||
            null,
          source: row.source,
          address: row.shippingAddressSnapshot,
        });
        if (!userId) return false;

        const updated = await tx
          .update(orders)
          .set({ userId, updatedAt: new Date() })
          .where(and(eq(orders.id, row.id), isNull(orders.userId)))
          .returning({ id: orders.id });
        if (updated.length === 0) return false;

        await insertAuditLog(tx as unknown as Database, {
          id: uuidv7(),
          actorId: actor.id,
          actorRole: actor.role,
          action: "customer.link_order",
          entityType: "order",
          entityId: row.id,
          before: { userId: null },
          after: { userId },
        });
        return true;
      });
      if (didLink) linked += 1;
    } catch {
      // One bad snapshot must not hide the rest of the directory.
    }
  }

  return linked;
}
