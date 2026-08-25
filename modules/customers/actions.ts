"use server";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  addresses,
  customerProfiles,
  db,
  insertAuditLog,
  orders,
  users,
  type Database,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { requirePermission } from "@/modules/auth";

import { planMergeOrderReassignment } from "./merge-logic";
import {
  crmPlaceholderEmail,
  normalizePhoneDigits,
} from "./phone";
import { parseCrmSource, type CrmSource } from "./source";
import type { CustomerActionResult } from "./types";

async function ensureProfile(
  tx: Database,
  userId: string,
  fields: {
    whatsappNumber?: string | null;
    source?: string | null;
    internalNotes?: string | null;
  },
) {
  const [existing] = await tx
    .select({ userId: customerProfiles.userId })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  if (existing) {
    await tx
      .update(customerProfiles)
      .set({
        whatsappNumber: fields.whatsappNumber ?? undefined,
        source: fields.source ?? undefined,
        internalNotes: fields.internalNotes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(customerProfiles.userId, userId));
    return;
  }

  await tx.insert(customerProfiles).values({
    userId,
    whatsappNumber: fields.whatsappNumber ?? null,
    source: fields.source ?? null,
    internalNotes: fields.internalNotes ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** Create CRM customer from phone (optionally noting a same-phone conflict). */
export async function createCustomerFromPhone(input: {
  phone: string;
  name?: string;
  source?: string;
  conflictWithName?: string | null;
  conflictWithDigits?: string | null;
}): Promise<CustomerActionResult> {
  const session = await requirePermission("customers.edit");
  const digits = normalizePhoneDigits(input.phone);
  if (digits.length < 10) {
    return { ok: false, error: "Enter a phone number with at least 10 digits." };
  }

  const source = parseCrmSource(input.source) ?? ("PHONE" as CrmSource);
  const name = input.name?.trim() || `Customer ${digits.slice(-4)}`;
  const email = crmPlaceholderEmail(digits);
  const notes = input.conflictWithDigits
    ? `CRM: different person, same phone as ${input.conflictWithName ?? "existing record"} (${input.conflictWithDigits}).`
    : null;

  const userId = uuidv7();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email,
        name,
        phone: digits,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(customerProfiles).values({
        userId,
        whatsappNumber: digits,
        source,
        internalNotes: notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "customer.create_from_phone",
        entityType: "customer_profile",
        entityId: userId,
        before: null,
        after: {
          phone: digits,
          source,
          conflictWithDigits: input.conflictWithDigits ?? null,
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create customer.";
    if (msg.toLowerCase().includes("unique") || msg.includes("23505")) {
      return {
        ok: false,
        error: "A customer with this email or phone already exists.",
      };
    }
    return { ok: false, error: msg };
  }

  revalidatePath("/admin/customers");
  return { ok: true, userId, href: `/admin/customers/${userId}` };
}

/** Soft confirm phone match — audit only; UI navigates to existing record. */
export async function confirmPhoneMatch(input: {
  userId?: string | null;
  guestDigits?: string | null;
  typedPhone: string;
}): Promise<CustomerActionResult> {
  const session = await requirePermission("customers.edit");
  const digits = normalizePhoneDigits(input.typedPhone);

  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "customer.confirm_phone_match",
    entityType: "customer_profile",
    entityId: input.userId ?? input.guestDigits ?? digits,
    before: null,
    after: {
      typedPhone: digits,
      userId: input.userId ?? null,
      guestDigits: input.guestDigits ?? null,
    },
  });

  if (input.userId) {
    return {
      ok: true,
      userId: input.userId,
      href: `/admin/customers/${input.userId}`,
    };
  }
  if (input.guestDigits) {
    const g = normalizePhoneDigits(input.guestDigits);
    return {
      ok: true,
      userId: "",
      href: `/admin/customers/guest/${encodeURIComponent(g)}`,
    };
  }
  return { ok: false, error: "No match target." };
}

type CustomerRef =
  | { kind: "account"; userId: string }
  | { kind: "guest"; digits: string };

function parseRef(ref: string): CustomerRef | null {
  if (ref.startsWith("user:")) {
    return { kind: "account", userId: ref.slice(5) };
  }
  if (ref.startsWith("guest:")) {
    return { kind: "guest", digits: normalizePhoneDigits(ref.slice(6)) };
  }
  return null;
}

/** Promote guest WhatsApp orders into a new or existing CUSTOMER profile. */
async function ensureAccountForRef(
  tx: Database,
  ref: CustomerRef,
  actor: { id: string; role: string },
): Promise<string> {
  if (ref.kind === "account") return ref.userId;

  const digits = ref.digits;
  // Prefer existing CUSTOMER with this phone/whatsapp (not merged)
  const [byProfile] = await tx
    .select({ userId: customerProfiles.userId })
    .from(customerProfiles)
    .innerJoin(users, eq(users.id, customerProfiles.userId))
    .where(
      and(
        eq(customerProfiles.whatsappNumber, digits),
        isNull(customerProfiles.mergedIntoUserId),
        eq(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (byProfile) return byProfile.userId;

  const [byPhone] = await tx
    .select({ id: users.id })
    .from(users)
    .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(
      and(
        eq(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
        eq(users.phone, digits),
        isNull(customerProfiles.mergedIntoUserId),
      ),
    )
    .limit(1);

  if (byPhone) {
    await ensureProfile(tx, byPhone.id, { whatsappNumber: digits });
    return byPhone.id;
  }

  // Name from latest guest order
  const [latest] = await tx
    .select({
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
      guestEmail: orders.guestEmail,
      source: orders.source,
    })
    .from(orders)
    .where(
      and(
        sql`regexp_replace(${orders.whatsappNumber}, '\\D', '', 'g') = ${digits}`,
        sql`${orders.status} not in ('DRAFT', 'CANCELLED')`,
      ),
    )
    .orderBy(sql`${orders.placedAt} desc nulls last`)
    .limit(1);

  const userId = uuidv7();
  const name =
    latest?.shippingAddressSnapshot?.recipientName?.trim() ||
    `Guest ${digits.slice(-4)}`;
  const email =
    latest?.guestEmail?.trim() || crmPlaceholderEmail(digits);

  await tx.insert(users).values({
    id: userId,
    email,
    name,
    phone: digits,
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerified: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await tx.insert(customerProfiles).values({
    userId,
    whatsappNumber: digits,
    source: latest?.source ?? "WHATSAPP",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Attach guest orders to new account
  await tx
    .update(orders)
    .set({ userId, updatedAt: new Date() })
    .where(
      and(
        sql`regexp_replace(${orders.whatsappNumber}, '\\D', '', 'g') = ${digits}`,
        or(isNull(orders.userId), eq(orders.userId, userId)),
      ),
    );

  await insertAuditLog(tx as unknown as Database, {
    id: uuidv7(),
    actorId: actor.id,
    actorRole: actor.role,
    action: "customer.promote_guest",
    entityType: "customer_profile",
    entityId: userId,
    before: { guestDigits: digits },
    after: { userId },
  });

  return userId;
}

export async function mergeCustomers(input: {
  survivorRef: string;
  loserRef: string;
}): Promise<CustomerActionResult> {
  const session = await requirePermission("customers.edit");

  const survivorParsed = parseRef(input.survivorRef);
  const loserParsed = parseRef(input.loserRef);
  if (!survivorParsed || !loserParsed) {
    return { ok: false, error: "Invalid merge targets." };
  }
  if (input.survivorRef === input.loserRef) {
    return { ok: false, error: "Pick two different records." };
  }

  try {
    const survivorUserId = await db.transaction(async (tx) => {
      const dbx = tx as unknown as Database;
      const survivorId = await ensureAccountForRef(dbx, survivorParsed, {
        id: session.user.id,
        role: session.user.role,
      });
      const loserId = await ensureAccountForRef(dbx, loserParsed, {
        id: session.user.id,
        role: session.user.role,
      });

      if (survivorId === loserId) {
        throw new Error("Both records resolve to the same account.");
      }

      const [loserProfile] = await tx
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, loserId))
        .limit(1);

      if (loserProfile?.mergedIntoUserId) {
        throw new Error("That record was already merged.");
      }

      const [survivorUser] = await tx
        .select({
          id: users.id,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, survivorId))
        .limit(1);

      const [survivorProfile] = await tx
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, survivorId))
        .limit(1);

      const loserWa =
        normalizePhoneDigits(loserProfile?.whatsappNumber ?? "") ||
        null;

      const allOrders = await tx
        .select({
          id: orders.id,
          userId: orders.userId,
          whatsappNumber: orders.whatsappNumber,
          totalMinor: orders.totalMinor,
        })
        .from(orders)
        .where(
          and(
            sql`${orders.status} not in ('DRAFT', 'CANCELLED')`,
            or(
              eq(orders.userId, survivorId),
              eq(orders.userId, loserId),
              loserWa
                ? sql`regexp_replace(${orders.whatsappNumber}, '\\D', '', 'g') = ${loserWa}`
                : sql`false`,
            ),
          ),
        );

      const plan = planMergeOrderReassignment({
        survivorUserId: survivorId,
        loserUserId: loserId,
        loserWhatsappDigits: loserWa,
        orders: allOrders,
        normalizePhone: normalizePhoneDigits,
      });

      if (plan.orderIdsToSurvivor.length > 0) {
        await tx
          .update(orders)
          .set({ userId: survivorId, updatedAt: new Date() })
          .where(inArray(orders.id, plan.orderIdsToSurvivor));
      }

      // Prefer survivor WhatsApp when aligning
      const survivorWa =
        normalizePhoneDigits(survivorProfile?.whatsappNumber ?? "") ||
        normalizePhoneDigits(survivorUser?.phone ?? "");
      if (survivorWa.length >= 10 && plan.orderIdsToSurvivor.length > 0) {
        await tx
          .update(orders)
          .set({ whatsappNumber: survivorWa, updatedAt: new Date() })
          .where(inArray(orders.id, plan.orderIdsToSurvivor));
      }

      // Move addresses
      await tx
        .update(addresses)
        .set({ userId: survivorId, updatedAt: new Date() })
        .where(
          and(eq(addresses.userId, loserId), isNull(addresses.deletedAt)),
        );

      await ensureProfile(dbx, survivorId, {
        whatsappNumber:
          survivorProfile?.whatsappNumber ??
          loserProfile?.whatsappNumber ??
          (survivorWa.length >= 10 ? survivorWa : null),
      });

      await tx
        .update(customerProfiles)
        .set({
          totalOrdersCount: plan.survivorOrderCount,
          lifetimeValueMinor: plan.survivorLifetimeValueMinor,
          updatedAt: new Date(),
        })
        .where(eq(customerProfiles.userId, survivorId));

      const now = new Date();
      await ensureProfile(dbx, loserId, {});
      await tx
        .update(customerProfiles)
        .set({
          mergedIntoUserId: survivorId,
          mergedAt: now,
          updatedAt: now,
        })
        .where(eq(customerProfiles.userId, loserId));

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "customer.merge",
        entityType: "customer_profile",
        entityId: survivorId,
        before: {
          survivorRef: input.survivorRef,
          loserRef: input.loserRef,
          loserId,
        },
        after: {
          survivorId,
          ordersMoved: plan.orderIdsToSurvivor.length,
          survivorOrderCount: plan.survivorOrderCount,
          survivorLifetimeValueMinor: plan.survivorLifetimeValueMinor,
        },
      });

      return survivorId;
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${survivorUserId}`);
    return {
      ok: true,
      userId: survivorUserId,
      href: `/admin/customers/${survivorUserId}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Merge failed.",
    };
  }
}
