import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  assets,
  db,
  designs,
  orderEvents,
  orderItems,
  orderPayments,
  orderPhotos,
  orders,
  payments,
  productionJobs,
  users,
} from "@aks/db";

import { requirePermission } from "@/modules/auth";
import { createPresignedReadUrl } from "@/modules/platform/assets";

import type { OrderStatus } from "./constants";
import {
  derivePaymentStatus,
  deriveProductionStatus,
  dueTone,
  daysUntilPromised,
  formatRelativeDue,
  FUNNEL_PRODUCTION_STAGES,
  IN_PROGRESS_PRODUCTION_STATUSES,
  isOrderAtRisk,
  isOrderDueSoon,
  isOrderOverdue,
  isTerminalOrderStatus,
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_TO_ORDER_STATUSES,
  type DueTone,
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
  /** overdue = past promised; soon = within 3 days */
  due?: "overdue" | "soon";
  /** Restrict completed to calendar month (shop local approx via Date) */
  completedThisMonth?: boolean;
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
  customerWhatsapp: string | null;
  placedAt: Date | null;
  productionStatus: ProductionStatus;
  paymentStatus: PaymentStatus;
  totalMinor: number;
  promisedShipDate: Date | null;
  atRisk: boolean;
  dueTone: DueTone;
  relativeDue: string;
  daysUntilDue: number | null;
  itemSummary: string;
  sizeLabel: string | null;
  source: string;
  status: OrderStatus;
};

export type OrderListResult = {
  items: OrderListItem[];
  total: number;
  page: number;
  perPage: number;
};

export type OrdersListOverview = {
  inProgress: number;
  dueSoon: number;
  overdue: number;
  completedThisMonth: number;
  open: number;
  newCount: number;
  balanceDue: number;
  funnel: Array<{ stage: ProductionStatus; label: string; count: number }>;
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

function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function endOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

async function firstItemsByOrderId(
  orderIds: string[],
): Promise<
  Map<string, { name: string; sizeLabel: string | null; sizeMode: string }>
> {
  const map = new Map<
    string,
    { name: string; sizeLabel: string | null; sizeMode: string }
  >();
  if (orderIds.length === 0) return map;

  const rows = await db
    .select({
      orderId: orderItems.orderId,
      designSnapshot: orderItems.designSnapshot,
      sizeLabel: orderItems.sizeLabel,
      sizeMode: orderItems.sizeMode,
      createdAt: orderItems.createdAt,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(orderItems.createdAt);

  for (const row of rows) {
    if (map.has(row.orderId)) continue;
    map.set(row.orderId, {
      name: row.designSnapshot.name,
      sizeLabel: row.sizeLabel,
      sizeMode: row.sizeMode,
    });
  }
  return map;
}

export async function listOrders(
  filters: OrderListFilters = {},
): Promise<OrderListResult> {
  await requirePermission("orders.view");

  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 25));
  const offset = (page - 1) * perPage;
  const now = new Date();

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

  if (filters.completedThisMonth) {
    conditions.push(eq(orders.status, "COMPLETED"));
    conditions.push(gte(orders.updatedAt, startOfMonth(now)));
    conditions.push(lte(orders.updatedAt, endOfMonth(now)));
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
      whatsappNumber: orders.whatsappNumber,
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

  const itemMap = await firstItemsByOrderId(rows.map((r) => r.id));

  const allItems: OrderListItem[] = [];
  for (const row of rows) {
    const paidMinor = await sumPaidMinor(row.id);
    const status = row.status as OrderStatus;
    const productionStatus = deriveProductionStatus(status);
    const paymentStatus = derivePaymentStatus({
      status,
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
      status,
      now,
    });

    if (filters.atRisk === true && !atRisk) continue;
    if (filters.atRisk === false && atRisk) continue;

    if (filters.due === "overdue" && !isOrderOverdue({ promisedShipDate: row.promisedShipDate, status, now })) {
      continue;
    }
    if (filters.due === "soon" && !isOrderDueSoon({ promisedShipDate: row.promisedShipDate, status, now })) {
      continue;
    }

    const customerName =
      row.customerName ??
      row.shippingAddressSnapshot.recipientName ??
      row.guestEmail ??
      row.shippingAddressSnapshot.phone;

    const firstItem = itemMap.get(row.id);
    const sizeLabel =
      firstItem?.sizeLabel ??
      (firstItem?.sizeMode === "MADE_TO_MEASURE" ? "MTM" : null);

    allItems.push({
      id: row.id,
      orderNumber: row.orderNumber,
      customerName,
      customerUserId: row.userId,
      customerWhatsapp: row.whatsappNumber || null,
      placedAt: row.placedAt,
      productionStatus,
      paymentStatus,
      totalMinor: row.totalMinor,
      promisedShipDate: row.promisedShipDate,
      atRisk,
      dueTone: dueTone({ promisedShipDate: row.promisedShipDate, status, now }),
      relativeDue: formatRelativeDue({
        promisedShipDate: row.promisedShipDate,
        status,
        now,
      }),
      daysUntilDue: daysUntilPromised(row.promisedShipDate, now),
      itemSummary: firstItem?.name ?? "—",
      sizeLabel,
      source: row.source,
      status,
    });
  }

  const total = allItems.length;
  const items = allItems.slice(offset, offset + perPage);

  return { items, total, page, perPage };
}

export async function getOrdersListOverview(): Promise<OrdersListOverview> {
  await requirePermission("orders.view");
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      balanceAmountMinor: orders.balanceAmountMinor,
      totalMinor: orders.totalMinor,
      promisedShipDate: orders.promisedShipDate,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(sql`${orders.status} <> 'DRAFT'`);

  let inProgress = 0;
  let dueSoon = 0;
  let overdue = 0;
  let completedThisMonth = 0;
  let open = 0;
  let newCount = 0;
  let balanceDue = 0;
  const funnelCounts = Object.fromEntries(
    FUNNEL_PRODUCTION_STAGES.map((s) => [s, 0]),
  ) as Record<ProductionStatus, number>;

  for (const row of rows) {
    const status = row.status as OrderStatus;
    const production = deriveProductionStatus(status);
    const paidMinor = await sumPaidMinor(row.id);
    const payment = derivePaymentStatus({
      status,
      balanceAmountMinor: row.balanceAmountMinor,
      paidMinor,
      totalMinor: row.totalMinor,
    });

    if (!isTerminalOrderStatus(status)) {
      open += 1;
      if (production === "RECEIVED") newCount += 1;
      if (IN_PROGRESS_PRODUCTION_STATUSES.includes(production)) inProgress += 1;
      if (isOrderDueSoon({ promisedShipDate: row.promisedShipDate, status, now })) {
        dueSoon += 1;
      }
      if (isOrderOverdue({ promisedShipDate: row.promisedShipDate, status, now })) {
        overdue += 1;
      }
    }

    if (
      status === "COMPLETED" &&
      row.updatedAt >= monthStart &&
      row.updatedAt <= monthEnd
    ) {
      completedThisMonth += 1;
    }

    if (payment === "BALANCE_DUE") balanceDue += 1;

    if (FUNNEL_PRODUCTION_STAGES.includes(production as (typeof FUNNEL_PRODUCTION_STAGES)[number])) {
      funnelCounts[production] += 1;
    }
  }

  return {
    inProgress,
    dueSoon,
    overdue,
    completedThisMonth,
    open,
    newCount,
    balanceDue,
    funnel: FUNNEL_PRODUCTION_STAGES.map((stage) => ({
      stage,
      label: PRODUCTION_STATUS_LABELS[stage],
      count: funnelCounts[stage] ?? 0,
    })),
  };
}

export type OrderDetailItem = {
  id: string;
  designId: string;
  designName: string;
  designSlug: string;
  thumbnailUrl: string | null;
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
  skipEmbroidery: boolean;
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
  /** 1-based ordinal among this customer's placed orders */
  customerOrderOrdinal: number | null;
  primaryProductionJobId: string | null;
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

  let customerOrderOrdinal: number | null = null;
  const ordinalCutoff = order.placedAt ?? order.createdAt;
  if (order.userId) {
    const prior = await db
      .select({ total: count() })
      .from(orders)
      .where(
        and(
          eq(orders.userId, order.userId),
          ne(orders.status, "DRAFT"),
          lte(orders.placedAt, ordinalCutoff),
        ),
      );
    customerOrderOrdinal = Number(prior[0]?.total ?? 0) || null;
  } else if (order.whatsappNumber) {
    const prior = await db
      .select({ total: count() })
      .from(orders)
      .where(
        and(
          eq(orders.whatsappNumber, order.whatsappNumber),
          ne(orders.status, "DRAFT"),
          lte(orders.placedAt, ordinalCutoff),
        ),
      );
    customerOrderOrdinal = Number(prior[0]?.total ?? 0) || null;
  }

  const itemIds = items.map((i) => i.id);
  let primaryProductionJobId: string | null = null;
  if (itemIds.length > 0) {
    const [job] = await db
      .select({ id: productionJobs.id })
      .from(productionJobs)
      .where(inArray(productionJobs.orderItemId, itemIds))
      .orderBy(productionJobs.createdAt)
      .limit(1);
    primaryProductionJobId = job?.id ?? null;
  }

  const designIds = [...new Set(items.map((i) => i.designId))];
  const designNameById = new Map<string, string>();
  if (designIds.length > 0) {
    const designRows = await db
      .select({ id: designs.id, name: designs.name })
      .from(designs)
      .where(inArray(designs.id, designIds));
    for (const row of designRows) {
      designNameById.set(row.id, row.name);
    }
  }

  // Always derive balance from money received — stored balance can drift.
  const balanceDueMinor = Math.max(0, order.totalMinor - paidMinor);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status,
    productionStatus: deriveProductionStatus(status),
    paymentStatus: derivePaymentStatus({
      status,
      balanceAmountMinor: balanceDueMinor,
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
    balanceAmountMinor: balanceDueMinor,
    paidMinor,
    paymentPlan: order.paymentPlan,
    customerNotes: order.customerNotes,
    internalNotes: order.internalNotes,
    cancelReason: order.cancelReason,
    skipEmbroidery: order.skipEmbroidery,
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
      designId: item.designId,
      designName: designNameById.get(item.designId) ?? item.designSnapshot.name,
      designSlug: item.designSnapshot.slug,
      thumbnailUrl: item.designSnapshot.thumbnailUrl ?? null,
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
    customerOrderOrdinal,
    primaryProductionJobId,
  };
}
