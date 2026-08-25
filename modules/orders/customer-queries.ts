import { desc, eq } from "drizzle-orm";

import {
  db,
  orderEvents,
  orderItems,
  orderPhotos,
  orders,
  users,
  assets,
} from "@aks/db";

import { auth } from "@/auth";
import { createPresignedReadUrl } from "@/modules/platform/assets";

import type { OrderStatus } from "./constants";
import {
  buildProductionTimeline,
  deriveProductionStatus,
  type ProductionStatus,
  type ProductionTimelineStep,
} from "./status";

export type CustomerOrderView = {
  orderNumber: string;
  status: OrderStatus;
  productionStatus: ReturnType<typeof deriveProductionStatus>;
  skipEmbroidery: boolean;
  timeline: ProductionTimelineStep[];
  placedAt: Date | null;
  promisedShipDate: Date | null;
  totalMinor: number;
  currency: string;
  customerNotes: string | null;
  items: Array<{
    designName: string;
    sizeMode: "STANDARD" | "MADE_TO_MEASURE";
    sizeLabel: string | null;
    quantity: number;
  }>;
  photos: Array<{ stage: string; readUrl: string | null }>;
};

function formatStepDay(value: Date, now = new Date()): string {
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(value);
  const sameDay =
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate();
  return sameDay ? `${day} · today` : day;
}

const ORDER_TO_TIMELINE_KEY: Partial<Record<OrderStatus, ProductionStatus>> = {
  AWAITING_DEPOSIT: "RECEIVED",
  DEPOSIT_PAID: "CONFIRMED",
  MEASUREMENTS_CONFIRMED: "MEASUREMENTS_VERIFIED",
  CUTTING: "CUTTING",
  IN_PRODUCTION: "CUTTING",
  STITCHING: "STITCHING",
  EMBROIDERY: "EMBROIDERY",
  FINISHING: "FINISHING",
  QUALITY_CHECK: "QUALITY_CHECK",
  READY_TO_SHIP: "PACKED",
  DISPATCHED: "DISPATCHED",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
};

async function stampTimeline(
  orderId: string,
  timeline: ProductionTimelineStep[],
  placedAt: Date | null,
): Promise<ProductionTimelineStep[]> {
  const events = await db
    .select({
      toStatus: orderEvents.toStatus,
      createdAt: orderEvents.createdAt,
    })
    .from(orderEvents)
    .where(eq(orderEvents.entityId, orderId))
    .orderBy(desc(orderEvents.createdAt));

  const stamps = new Map<ProductionStatus, string>();
  if (placedAt) stamps.set("RECEIVED", formatStepDay(placedAt));
  for (const event of events) {
    const key = ORDER_TO_TIMELINE_KEY[event.toStatus as OrderStatus];
    if (key && !stamps.has(key)) {
      stamps.set(key, formatStepDay(event.createdAt));
    }
  }

  return timeline.map((step) => ({
    ...step,
    atLabel: stamps.get(step.key) ?? null,
  }));
}

async function loadCustomerPhotos(orderId: string) {
  const rows = await db
    .select({
      stage: orderPhotos.stage,
      isCustomerVisible: orderPhotos.isCustomerVisible,
      r2Key: assets.r2Key,
    })
    .from(orderPhotos)
    .innerJoin(assets, eq(orderPhotos.assetId, assets.id))
    .where(eq(orderPhotos.orderId, orderId))
    .orderBy(desc(orderPhotos.createdAt));

  const photos = [];
  for (const row of rows) {
    if (!row.isCustomerVisible || !row.r2Key) continue;
    let readUrl: string | null = null;
    try {
      readUrl = await createPresignedReadUrl(row.r2Key, 3600);
    } catch {
      readUrl = null;
    }
    photos.push({ stage: row.stage, readUrl });
  }
  return photos;
}

async function mapCustomerOrder(
  order: typeof orders.$inferSelect,
  items: (typeof orderItems.$inferSelect)[],
): Promise<CustomerOrderView> {
  const status = order.status as OrderStatus;
  const timeline = await stampTimeline(
    order.id,
    buildProductionTimeline({
      currentStatus: status,
      skipEmbroidery: order.skipEmbroidery,
    }),
    order.placedAt,
  );
  return {
    orderNumber: order.orderNumber,
    status,
    productionStatus: deriveProductionStatus(status),
    skipEmbroidery: order.skipEmbroidery,
    timeline,
    placedAt: order.placedAt,
    promisedShipDate: order.promisedShipDate,
    totalMinor: order.totalMinor,
    currency: order.currency,
    customerNotes: order.customerNotes,
    items: items.map((item) => ({
      designName: item.designSnapshot.name,
      sizeMode: item.sizeMode,
      sizeLabel: item.sizeLabel,
      quantity: item.quantity,
    })),
    photos: [],
  };
}

export async function getCustomerOrderByNumber(
  orderNumber: string,
): Promise<CustomerOrderView | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (!order || order.userId !== session.user.id) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.createdAt);

  const view = await mapCustomerOrder(order, items);
  view.photos = await loadCustomerPhotos(order.id);
  return view;
}

export async function getTrackedOrderByNumber(
  orderNumber: string,
): Promise<CustomerOrderView | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.createdAt);

  const view = await mapCustomerOrder(order, items);
  const photos = await db
    .select({
      stage: orderPhotos.stage,
      isCustomerVisible: orderPhotos.isCustomerVisible,
      r2Key: assets.r2Key,
    })
    .from(orderPhotos)
    .innerJoin(assets, eq(orderPhotos.assetId, assets.id))
    .where(eq(orderPhotos.orderId, order.id))
    .orderBy(desc(orderPhotos.createdAt));

  view.photos = [];
  for (const row of photos) {
    if (!row.isCustomerVisible) continue;
    let readUrl: string | null = null;
    try {
      readUrl = row.r2Key ? await createPresignedReadUrl(row.r2Key, 3600) : null;
    } catch {
      readUrl = null;
    }
    view.photos.push({ stage: row.stage, readUrl });
  }

  return view;
}

export async function listCustomerOrders(): Promise<
  Array<{ orderNumber: string; placedAt: Date | null; productionStatus: string }>
> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      placedAt: orders.placedAt,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.placedAt));

  return rows.map((row) => ({
    orderNumber: row.orderNumber,
    placedAt: row.placedAt,
    productionStatus: deriveProductionStatus(row.status as OrderStatus),
  }));
}

export async function getOrderRecipientVars(orderId: string) {
  const [order] = await db
    .select({
      orderNumber: orders.orderNumber,
      guestEmail: orders.guestEmail,
      userId: orders.userId,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return null;

  const [user] = order.userId
    ? await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, order.userId))
        .limit(1)
    : [null];

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return {
    recipient: user?.email ?? order.guestEmail,
    vars: {
      orderNumber: order.orderNumber,
      customerName:
        user?.name ?? order.shippingAddressSnapshot.recipientName ?? "there",
      trackUrl: `${base}/en/track/${encodeURIComponent(order.orderNumber)}`,
    },
  };
}
