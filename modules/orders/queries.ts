"use server";

import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  assets,
  db,
  orderEvents,
  orderItems,
  orderPayments,
  orderPhotos,
  orders,
  payments,
  users,
} from "@aks/db";

import { requirePermission } from "@/modules/auth";
import { createPresignedReadUrl } from "@/modules/platform/assets";

import type { OrderStatus } from "./constants";
import {
  derivePaymentStatus,
  deriveProductionStatus,
  isOrderAtRisk,
  PRODUCTION_TO_ORDER_STATUSES,
  type PaymentStatus,
  type ProductionStatus,
} from "./status";

export type OrderListFilters = {
  q?: string;
  productionStatus?: ProductionStatus[];
  paymentStatus?: PaymentStatus[];
  source?: string[];
  sizeMode?: ("STANDARD" | "MADE_TO_MEASURE")[];
  atRisk?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  perPage?: number;
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerUserId: string | null;
  placedAt: Date | null;
  productionStatus: ProductionStatus;
  paymentStatus: PaymentStatus;
  totalMinor: number;
  promisedShipDate: Date | null;
  atRisk: boolean;
  source: string;
};

export type OrderListResult = {
  items: OrderListItem[];
  total: number;
  page: number;
  perPage: number;
};

function buildProductionStatusFilter(
  statuses: ProductionStatus[],
): OrderStatus[] {
  const set = new Set<OrderStatus>();
  for (const ps of statuses) {
    for (const os of PRODUCTION_TO_ORDER_STATUSES[ps] ?? []) {
      set.add(os);
    }
  }
  return [...set];
}

async function sumPaidMinor(orderId: string): Promise<number> {
  const [manualRows, providerRows] = await Promise.all([
    db
      .select({
        total: sql<number>`coalesce(sum(${orderPayments.amountMinor}), 0)`,
      })
      .from(orderPayments)
      .where(
        and(
          eq(orderPayments.orderId, orderId),
          inArray(orderPayments.status, ["SUCCEEDED", "REFUNDED"]),
        ),
      ),
    db
      .select({
        total: sql<number>`coalesce(sum(${payments.amountMinor}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.orderId, orderId),
          inArray(payments.status, ["SUCCEEDED", "REFUNDED"]),
        ),
      ),
  ]);

  return (
    Number(manualRows[0]?.total ?? 0) + Number(providerRows[0]?.total ?? 0)
  );
}

export async function listOrders(
  filters: OrderListFilters = {},
): Promise<OrderListResult> {
  await requirePermission("orders.view");

  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 25));
  const offset = (page - 1) * perPage;

  const conditions = [];

  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(orders.orderNumber, term),
        ilike(orders.guestEmail, term),
        ilike(orders.guestPhone, term),
        ilike(orders.whatsappNumber, term),
        sql`${orders.shippingAddressSnapshot}->>'recipientName' ilike ${term}`,
      ),
    );
  }

  if (filters.productionStatus?.length) {
    const mapped = buildProductionStatusFilter(filters.productionStatus);
    if (mapped.length) {
      conditions.push(inArray(orders.status, mapped));
    }
  }

  if (filters.source?.length) {
    conditions.push(
      inArray(
        orders.source,
        filters.source as ("WEB" | "WHATSAPP" | "INSTAGRAM" | "PHONE" | "WALK_IN")[],
      ),
    );
  }

  if (filters.dateFrom) {
    conditions.push(gte(orders.placedAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(orders.placedAt, filters.dateTo));
  }

  if (filters.sizeMode?.length) {
    conditions.push(
      sql`exists (
        select 1 from ${orderItems}
        where ${orderItems.orderId} = ${orders.id}
        and ${orderItems.sizeMode} in (${sql.join(
          filters.sizeMode.map((m) => sql`${m}`),
          sql`, `,
        )})
      )`,
    );
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      userId: orders.userId,
      guestEmail: orders.guestEmail,
      status: orders.status,
      totalMinor: orders.totalMinor,
      balanceAmountMinor: orders.balanceAmountMinor,
      promisedShipDate: orders.promisedShipDate,
      placedAt: orders.placedAt,
      source: orders.source,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(whereClause)
    .orderBy(desc(orders.placedAt), desc(orders.createdAt));

  const allItems: OrderListItem[] = [];
  for (const row of rows) {
    const paidMinor = await sumPaidMinor(row.id);
    const productionStatus = deriveProductionStatus(row.status as OrderStatus);
    const paymentStatus = derivePaymentStatus({
      status: row.status as OrderStatus,
      balanceAmountMinor: row.balanceAmountMinor,
      paidMinor,
      totalMinor: row.totalMinor,
    });

    if (
      filters.paymentStatus?.length &&
      !filters.paymentStatus.includes(paymentStatus)
    ) {
      continue;
    }

    const atRisk = isOrderAtRisk({
      promisedShipDate: row.promisedShipDate,
      status: row.status as OrderStatus,
    });

    if (filters.atRisk === true && !atRisk) continue;
    if (filters.atRisk === false && atRisk) continue;

    const customerName =
      row.customerName ??
      row.shippingAddressSnapshot.recipientName ??
      row.guestEmail ??
      row.shippingAddressSnapshot.phone;

    allItems.push({
      id: row.id,
      orderNumber: row.orderNumber,
      customerName,
      customerUserId: row.userId,
      placedAt: row.placedAt,
      productionStatus,
      paymentStatus,
      totalMinor: row.totalMinor,
      promisedShipDate: row.promisedShipDate,
      atRisk,
      source: row.source,
    });
  }

  const total = allItems.length;
  const items = allItems.slice(offset, offset + perPage);

  return { items, total, page, perPage };
}

export type OrderDetailItem = {
  id: string;
  designName: string;
  designSlug: string;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  measurementSnapshot: {
    sessionId: string;
    values: Record<string, number>;
  } | null;
  customizationSnapshot: Record<string, string | boolean>;
  priceBreakdownSnapshot: {
    basePriceMinor: number;
    colourwayDeltaMinor: number;
    customizationDeltaMinor: number;
    madeToMeasureSurchargeMinor: number;
    unitPriceMinor: number;
  };
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
};

export type OrderDetailEvent = {
  id: string;
  fromStatus: string;
  toStatus: string;
  actorId: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: Date;
};

export type OrderDetailPayment = {
  id: string;
  kind: string;
  amountMinor: number;
  provider: string;
  status: string;
  note: string | null;
  createdAt: Date;
};

export type OrderDetailPhoto = {
  id: string;
  stage: string;
  isCustomerVisible: boolean;
  readUrl: string | null;
  createdAt: Date;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  productionStatus: ProductionStatus;
  paymentStatus: PaymentStatus;
  source: string;
  placedAt: Date | null;
  promisedShipDate: Date | null;
  atRisk: boolean;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  depositAmountMinor: number;
  balanceAmountMinor: number;
  paidMinor: number;
  paymentPlan: string;
  customerNotes: string | null;
  internalNotes: string | null;
  cancelReason: string | null;
  customer: {
    userId: string | null;
    name: string;
    email: string | null;
    phone: string;
    whatsappNumber: string;
  };
  shippingAddressSnapshot: {
    recipientName: string;
    phone: string;
    whatsappNumber: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    province: string;
    postalCode?: string | null;
    landmark?: string | null;
  };
  items: OrderDetailItem[];
  events: OrderDetailEvent[];
  payments: OrderDetailPayment[];
  photos: OrderDetailPhoto[];
};

export async function getOrderDetail(
  orderId: string,
): Promise<OrderDetail | null> {
  await requirePermission("orders.view");

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return null;

  const [customer] = order.userId
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, order.userId))
        .limit(1)
    : [null];

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.createdAt);

  const events = await db
    .select({
      id: orderEvents.id,
      fromStatus: orderEvents.fromStatus,
      toStatus: orderEvents.toStatus,
      actorId: orderEvents.actorId,
      note: orderEvents.note,
      createdAt: orderEvents.createdAt,
      actorName: users.name,
    })
    .from(orderEvents)
    .leftJoin(users, eq(orderEvents.actorId, users.id))
    .where(eq(orderEvents.entityId, orderId))
    .orderBy(desc(orderEvents.createdAt));

  const manualPayments = await db
    .select()
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId))
    .orderBy(desc(orderPayments.createdAt));

  const providerPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt));

  const paymentsCombined: OrderDetailPayment[] = [
    ...providerPayments.map((p) => ({
      id: p.id,
      kind: p.kind,
      amountMinor: p.amountMinor,
      provider: p.provider,
      status: p.status,
      note: p.providerRef ? `Safepay ref ${p.providerRef}` : null,
      createdAt: p.createdAt,
    })),
    ...manualPayments.map((p) => ({
      id: p.id,
      kind: p.kind,
      amountMinor: p.amountMinor,
      provider: p.provider,
      status: p.status,
      note: p.note,
      createdAt: p.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const paidMinor = paymentsCombined
    .filter((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED")
    .reduce((sum, p) => sum + p.amountMinor, 0);

  const photoRows = await db
    .select({
      id: orderPhotos.id,
      stage: orderPhotos.stage,
      isCustomerVisible: orderPhotos.isCustomerVisible,
      createdAt: orderPhotos.createdAt,
      r2Key: assets.r2Key,
    })
    .from(orderPhotos)
    .innerJoin(assets, eq(orderPhotos.assetId, assets.id))
    .where(eq(orderPhotos.orderId, orderId))
    .orderBy(desc(orderPhotos.createdAt));

  const photos: OrderDetailPhoto[] = [];
  for (const p of photoRows) {
    let readUrl: string | null = null;
    try {
      readUrl = await createPresignedReadUrl(p.r2Key, 3600);
    } catch {
      readUrl = null;
    }
    photos.push({
      id: p.id,
      stage: p.stage,
      isCustomerVisible: p.isCustomerVisible,
      readUrl,
      createdAt: p.createdAt,
    });
  }

  const status = order.status as OrderStatus;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status,
    productionStatus: deriveProductionStatus(status),
    paymentStatus: derivePaymentStatus({
      status,
      balanceAmountMinor: order.balanceAmountMinor,
      paidMinor,
      totalMinor: order.totalMinor,
    }),
    source: order.source,
    placedAt: order.placedAt,
    promisedShipDate: order.promisedShipDate,
    atRisk: isOrderAtRisk({
      promisedShipDate: order.promisedShipDate,
      status,
    }),
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    shippingMinor: order.shippingMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    depositAmountMinor: order.depositAmountMinor,
    balanceAmountMinor: order.balanceAmountMinor,
    paidMinor,
    paymentPlan: order.paymentPlan,
    customerNotes: order.customerNotes,
    internalNotes: order.internalNotes,
    cancelReason: order.cancelReason,
    customer: {
      userId: order.userId,
      name:
        customer?.name ??
        order.shippingAddressSnapshot.recipientName,
      email: customer?.email ?? order.guestEmail,
      phone: order.shippingAddressSnapshot.phone,
      whatsappNumber: order.whatsappNumber,
    },
    shippingAddressSnapshot: order.shippingAddressSnapshot,
    items: items.map((item) => ({
      id: item.id,
      designName: item.designSnapshot.name,
      designSlug: item.designSnapshot.slug,
      sizeMode: item.sizeMode,
      sizeLabel: item.sizeLabel,
      measurementSnapshot: item.measurementSnapshot,
      customizationSnapshot: item.customizationSnapshot,
      priceBreakdownSnapshot: item.priceBreakdownSnapshot,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
      lineTotalMinor: item.lineTotalMinor,
    })),
    events: events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorId: e.actorId,
      actorName: e.actorName,
      note: e.note,
      createdAt: e.createdAt,
    })),
    payments: paymentsCombined,
    photos,
  };
}
