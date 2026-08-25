"use server";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import {
  addresses,
  customerMeasurementProfiles,
  customerProfiles,
  db,
  garmentCategories,
  orders,
  users,
  type ShippingAddressSnapshot,
} from "@aks/db";

import { requirePermission } from "@/modules/auth";
import {
  deriveProductionStatus,
  PRODUCTION_STATUS_LABELS,
} from "@/modules/orders/status";
import type { OrderStatus } from "@/modules/orders/constants";

import { countHammingOnePairs } from "./merge-logic";
import {
  isPhoneCloseMatch,
  normalizePhoneDigits,
  phoneHammingDistance,
} from "./phone";
import { type CrmSourceFilter, parseCrmSource } from "./source";
import type {
  CustomerDetail,
  CustomerDetailAddress,
  CustomerDirectoryRow,
  ListCustomerDirectoryResult,
  MergeCandidate,
  PhoneMatchCandidate,
} from "./types";

const PLACED = sql`${orders.status} not in ('DRAFT', 'CANCELLED')`;

/** Drizzle/sql aggregates may return Date or ISO string depending on driver. */
function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function productionLabel(status: string): string {
  return (
    PRODUCTION_STATUS_LABELS[deriveProductionStatus(status as OrderStatus)] ??
    status
  );
}

function accountHref(userId: string): string {
  return `/admin/customers/${userId}`;
}

function guestHref(digits: string): string {
  return `/admin/customers/guest/${encodeURIComponent(digits)}`;
}

/**
 * Unified directory: non-merged accounts + guest WhatsApp rows
 * (orders whose digits are not claimed by a non-merged CUSTOMER).
 */
export async function listCustomerDirectory(input?: {
  query?: string;
  source?: CrmSourceFilter;
}): Promise<ListCustomerDirectoryResult> {
  await requirePermission("customers.view");

  const sourceFilter = input?.source ?? "ALL";
  const q = input?.query?.trim() ?? "";
  const qDigits = normalizePhoneDigits(q);
  const qLower = q.toLowerCase();

  const accountRows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      whatsappNumber: customerProfiles.whatsappNumber,
      source: customerProfiles.source,
      totalOrdersCount: customerProfiles.totalOrdersCount,
      lifetimeValueMinor: customerProfiles.lifetimeValueMinor,
      mergedIntoUserId: customerProfiles.mergedIntoUserId,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(
      and(
        eq(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
        isNull(customerProfiles.mergedIntoUserId),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(500);

  // Customers without a profile yet — still show
  const orphanAccounts = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(
      and(
        eq(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
        isNull(customerProfiles.userId),
      ),
    )
    .limit(200);

  const accountPhoneSet = new Set<string>();
  const directory: CustomerDirectoryRow[] = [];

  for (const row of accountRows) {
    const digits =
      normalizePhoneDigits(row.whatsappNumber ?? "") ||
      normalizePhoneDigits(row.phone ?? "");
    if (digits.length >= 10) accountPhoneSet.add(digits);
    directory.push({
      kind: "account",
      userId: row.userId,
      phoneDigits: digits,
      name: row.name,
      email: row.email,
      phoneDisplay: row.whatsappNumber ?? row.phone,
      firstContactSource: row.source,
      totalOrdersCount: row.totalOrdersCount ?? 0,
      lifetimeValueMinor: row.lifetimeValueMinor ?? 0,
      lastOrderAt: null,
      href: accountHref(row.userId),
    });
  }

  for (const row of orphanAccounts) {
    const digits = normalizePhoneDigits(row.phone ?? "");
    if (digits.length >= 10) accountPhoneSet.add(digits);
    directory.push({
      kind: "account",
      userId: row.userId,
      phoneDigits: digits,
      name: row.name,
      email: row.email,
      phoneDisplay: row.phone,
      firstContactSource: null,
      totalOrdersCount: 0,
      lifetimeValueMinor: 0,
      lastOrderAt: null,
      href: accountHref(row.userId),
    });
  }

  // Enrich account first-contact + last order from orders when profile source missing
  const accountIds = directory
    .filter((r) => r.kind === "account" && r.userId)
    .map((r) => r.userId!);

  if (accountIds.length > 0) {
    const orderAgg = await db
      .select({
        userId: orders.userId,
        firstSource: sql<string>`(
          select o2.source from orders o2
          where o2.user_id = ${orders.userId}
            and o2.status not in ('DRAFT', 'CANCELLED')
          order by o2.placed_at asc nulls last, o2.created_at asc
          limit 1
        )`,
        lastOrderAt: sql<Date | null>`max(${orders.placedAt})`,
        orderCount: sql<number>`count(*)::int`,
        ltv: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
      })
      .from(orders)
      .where(and(inArray(orders.userId, accountIds), PLACED))
      .groupBy(orders.userId);

    const byUser = new Map(
      orderAgg
        .filter((r) => r.userId)
        .map((r) => [r.userId!, r] as const),
    );

    for (const row of directory) {
      if (row.kind !== "account" || !row.userId) continue;
      const agg = byUser.get(row.userId);
      if (!agg) continue;
      if (!row.firstContactSource) {
        row.firstContactSource = agg.firstSource ?? null;
      }
      row.lastOrderAt = asDate(agg.lastOrderAt);
      if (row.totalOrdersCount === 0) {
        row.totalOrdersCount = agg.orderCount;
        row.lifetimeValueMinor = agg.ltv;
      }
    }
  }

  // Guest WhatsApp aggregates
  const guestOrders = await db
    .select({
      whatsappNumber: orders.whatsappNumber,
      guestEmail: orders.guestEmail,
      totalMinor: orders.totalMinor,
      placedAt: orders.placedAt,
      source: orders.source,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
      userId: orders.userId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(PLACED)
    .orderBy(asc(orders.placedAt))
    .limit(5000);

  type GuestBucket = {
    digits: string;
    display: string;
    name: string | null;
    email: string | null;
    firstSource: string | null;
    orderCount: number;
    ltv: number;
    lastOrderAt: Date | null;
  };

  const guests = new Map<string, GuestBucket>();

  for (const o of guestOrders) {
    const digits = normalizePhoneDigits(o.whatsappNumber);
    if (digits.length < 10) continue;
    if (accountPhoneSet.has(digits)) continue;
    // Skip if linked to a non-merged customer account phone via userId
    if (o.userId && accountIds.includes(o.userId)) continue;

    const existing = guests.get(digits);
    const name = o.shippingAddressSnapshot?.recipientName ?? null;
    if (!existing) {
      guests.set(digits, {
        digits,
        display: o.whatsappNumber,
        name,
        email: o.guestEmail,
        firstSource: o.source,
        orderCount: 1,
        ltv: o.totalMinor,
        lastOrderAt: asDate(o.placedAt),
      });
    } else {
      existing.orderCount += 1;
      existing.ltv += o.totalMinor;
      const placed = asDate(o.placedAt);
      if (
        placed &&
        (!existing.lastOrderAt || placed > existing.lastOrderAt)
      ) {
        existing.lastOrderAt = placed;
      }
      if (!existing.name && name) existing.name = name;
      if (!existing.email && o.guestEmail) existing.email = o.guestEmail;
    }
  }

  for (const g of guests.values()) {
    directory.push({
      kind: "guest",
      userId: null,
      phoneDigits: g.digits,
      name: g.name,
      email: g.email,
      phoneDisplay: g.display,
      firstContactSource: g.firstSource,
      totalOrdersCount: g.orderCount,
      lifetimeValueMinor: g.ltv,
      lastOrderAt: g.lastOrderAt,
      href: guestHref(g.digits),
    });
  }

  const duplicatePairCount = countHammingOnePairs(
    directory.map((r) => r.phoneDigits),
    normalizePhoneDigits,
    phoneHammingDistance,
  );

  let rows = directory;

  if (sourceFilter === "DUPLICATES") {
    const digitSet = new Set(
      rows.map((r) => r.phoneDigits).filter((d) => d.length >= 10),
    );
    const dupDigits = new Set<string>();
    const list = [...digitSet];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (phoneHammingDistance(list[i]!, list[j]!) === 1) {
          dupDigits.add(list[i]!);
          dupDigits.add(list[j]!);
        }
      }
    }
    rows = rows.filter((r) => dupDigits.has(r.phoneDigits));
  } else if (sourceFilter !== "ALL") {
    rows = rows.filter(
      (r) => parseCrmSource(r.firstContactSource) === sourceFilter,
    );
  }

  if (q) {
    rows = rows.filter((r) => {
      if (qDigits.length >= 3 && r.phoneDigits.includes(qDigits)) return true;
      if (r.name?.toLowerCase().includes(qLower)) return true;
      if (r.email?.toLowerCase().includes(qLower)) return true;
      if (r.phoneDisplay?.toLowerCase().includes(qLower)) return true;
      return false;
    });
  }

  rows.sort((a, b) => {
    const ta = asDate(a.lastOrderAt)?.getTime() ?? 0;
    const tb = asDate(b.lastOrderAt)?.getTime() ?? 0;
    return tb - ta;
  });

  return { rows: rows.slice(0, 200), duplicatePairCount };
}

export async function findPhoneMatches(
  typedPhone: string,
): Promise<PhoneMatchCandidate[]> {
  await requirePermission("customers.view");
  const digits = normalizePhoneDigits(typedPhone);
  if (digits.length < 10) return [];

  const { rows } = await listCustomerDirectory({});
  const matches: PhoneMatchCandidate[] = [];

  for (const row of rows) {
    if (row.phoneDigits.length < 10) continue;
    if (!isPhoneCloseMatch(digits, row.phoneDigits)) continue;
    matches.push({
      kind: row.kind,
      userId: row.userId,
      phoneDigits: row.phoneDigits,
      name: row.name,
      phoneDisplay: row.phoneDisplay,
      totalOrdersCount: row.totalOrdersCount,
      distance: phoneHammingDistance(digits, row.phoneDigits),
      href: row.href,
    });
  }

  matches.sort((a, b) => a.distance - b.distance);
  return matches.slice(0, 5);
}

function addressFromSnapshot(
  snap: ShippingAddressSnapshot | null | undefined,
): CustomerDetailAddress | null {
  if (!snap) return null;
  const lines = [
    [snap.addressLine1, snap.addressLine2].filter(Boolean).join(", "),
    [snap.city, snap.province.replaceAll("_", " ")].filter(Boolean).join(", "),
    snap.landmark ? `Near ${snap.landmark}` : null,
  ].filter(Boolean) as string[];
  return {
    recipientName: snap.recipientName,
    phone: snap.phone,
    lines,
  };
}

export async function getCustomerDetail(
  userId: string,
): Promise<CustomerDetail | null> {
  await requirePermission("customers.view");

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user) return null;

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      placedAt: orders.placedAt,
      totalMinor: orders.totalMinor,
      status: orders.status,
      source: orders.source,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), PLACED))
    .orderBy(desc(orders.placedAt));

  const profileRows = await db
    .select({
      id: customerMeasurementProfiles.id,
      label: customerMeasurementProfiles.label,
      categoryName: garmentCategories.name,
      isDefault: customerMeasurementProfiles.isDefault,
      updatedAt: customerMeasurementProfiles.updatedAt,
    })
    .from(customerMeasurementProfiles)
    .innerJoin(
      garmentCategories,
      eq(customerMeasurementProfiles.categoryId, garmentCategories.id),
    )
    .where(eq(customerMeasurementProfiles.userId, userId))
    .orderBy(desc(customerMeasurementProfiles.updatedAt));

  const savedAddresses = await db
    .select()
    .from(addresses)
    .where(
      and(eq(addresses.userId, userId), isNull(addresses.deletedAt)),
    )
    .orderBy(desc(addresses.isDefaultShipping), desc(addresses.updatedAt))
    .limit(1);

  const digits =
    normalizePhoneDigits(profile?.whatsappNumber ?? "") ||
    normalizePhoneDigits(user.phone ?? "");

  let contactAddress = addressFromSnapshot(
    orderRows[0]?.shippingAddressSnapshot,
  );
  const saved = savedAddresses[0];
  if (saved) {
    contactAddress = {
      recipientName: saved.recipientName,
      phone: saved.phone,
      lines: [
        [saved.addressLine1, saved.addressLine2].filter(Boolean).join(", "),
        [saved.city, saved.province.replaceAll("_", " ")].join(", "),
        saved.landmark ? `Near ${saved.landmark}` : null,
      ].filter(Boolean) as string[],
    };
  }

  const firstSource =
    profile?.source ??
    [...orderRows].reverse()[0]?.source ??
    null;

  return {
    kind: "account",
    userId: user.id,
    name: user.name,
    email: user.email?.endsWith("@customers.aks.local") ? null : user.email,
    phone: user.phone,
    whatsappNumber: profile?.whatsappNumber ?? user.phone,
    phoneDigits: digits,
    firstContactSource: firstSource,
    lifetimeValueMinor:
      profile?.lifetimeValueMinor ??
      orderRows.reduce((s, o) => s + o.totalMinor, 0),
    totalOrdersCount: profile?.totalOrdersCount ?? orderRows.length,
    codRefusalCount: profile?.codRefusalCount ?? 0,
    lastOrderAt: asDate(orderRows[0]?.placedAt ?? null),
    orders: orderRows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      placedAt: asDate(row.placedAt),
      totalMinor: row.totalMinor,
      status: row.status,
      source: row.source,
      productionLabel: productionLabel(row.status),
    })),
    measurementProfiles: profileRows,
    contactAddress,
    mergeHref: `/admin/customers/merge?a=${encodeURIComponent(`user:${user.id}`)}`,
  };
}

export async function getGuestCustomerDetail(
  whatsappRaw: string,
): Promise<CustomerDetail | null> {
  await requirePermission("customers.view");
  const digits = normalizePhoneDigits(whatsappRaw);
  if (digits.length < 10) return null;

  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      placedAt: orders.placedAt,
      totalMinor: orders.totalMinor,
      status: orders.status,
      source: orders.source,
      guestEmail: orders.guestEmail,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
      whatsappNumber: orders.whatsappNumber,
    })
    .from(orders)
    .where(
      and(
        or(
          eq(orders.whatsappNumber, digits),
          eq(orders.whatsappNumber, whatsappRaw),
          sql`regexp_replace(${orders.whatsappNumber}, '\\D', '', 'g') = ${digits}`,
        ),
        PLACED,
      ),
    )
    .orderBy(desc(orders.placedAt));

  if (orderRows.length === 0) return null;

  const latest = orderRows[0]!;
  const earliest = orderRows[orderRows.length - 1]!;

  return {
    kind: "guest",
    userId: null,
    name: latest.shippingAddressSnapshot.recipientName,
    email: latest.guestEmail,
    phone: latest.shippingAddressSnapshot.phone,
    whatsappNumber: latest.whatsappNumber,
    phoneDigits: digits,
    firstContactSource: earliest.source,
    lifetimeValueMinor: orderRows.reduce((s, o) => s + o.totalMinor, 0),
    totalOrdersCount: orderRows.length,
    codRefusalCount: 0,
    lastOrderAt: asDate(latest.placedAt),
    orders: orderRows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      placedAt: asDate(row.placedAt),
      totalMinor: row.totalMinor,
      status: row.status,
      source: row.source,
      productionLabel: productionLabel(row.status),
    })),
    measurementProfiles: [],
    contactAddress: addressFromSnapshot(latest.shippingAddressSnapshot),
    mergeHref: `/admin/customers/merge?a=${encodeURIComponent(`guest:${digits}`)}`,
  };
}

export async function listMergeCandidates(
  excludeRef?: string,
): Promise<MergeCandidate[]> {
  await requirePermission("customers.view");
  const { rows } = await listCustomerDirectory({});

  return rows
    .filter((r) => {
      const ref =
        r.kind === "account" && r.userId
          ? `user:${r.userId}`
          : `guest:${r.phoneDigits}`;
      return ref !== excludeRef;
    })
    .slice(0, 100)
    .map((r) => ({
      ref:
        r.kind === "account" && r.userId
          ? `user:${r.userId}`
          : `guest:${r.phoneDigits}`,
      kind: r.kind,
      userId: r.userId,
      phoneDigits: r.phoneDigits,
      name: r.name,
      phoneDisplay: r.phoneDisplay,
      firstContactSource: r.firstContactSource,
      totalOrdersCount: r.totalOrdersCount,
      lifetimeValueMinor: r.lifetimeValueMinor,
      addressSummary: null,
    }));
}

export async function resolveMergeCard(
  ref: string,
): Promise<MergeCandidate | null> {
  await requirePermission("customers.view");
  if (ref.startsWith("user:")) {
    const userId = ref.slice(5);
    const detail = await getCustomerDetail(userId);
    if (!detail) return null;
    return {
      ref,
      kind: "account",
      userId,
      phoneDigits: detail.phoneDigits,
      name: detail.name,
      phoneDisplay: detail.whatsappNumber ?? detail.phone,
      firstContactSource: detail.firstContactSource,
      totalOrdersCount: detail.totalOrdersCount,
      lifetimeValueMinor: detail.lifetimeValueMinor,
      addressSummary: detail.contactAddress?.lines[0] ?? null,
    };
  }
  if (ref.startsWith("guest:")) {
    const digits = ref.slice(6);
    const detail = await getGuestCustomerDetail(digits);
    if (!detail) return null;
    return {
      ref,
      kind: "guest",
      userId: null,
      phoneDigits: detail.phoneDigits,
      name: detail.name,
      phoneDisplay: detail.whatsappNumber,
      firstContactSource: detail.firstContactSource,
      totalOrdersCount: detail.totalOrdersCount,
      lifetimeValueMinor: detail.lifetimeValueMinor,
      addressSummary: detail.contactAddress?.lines[0] ?? null,
    };
  }
  return null;
}
