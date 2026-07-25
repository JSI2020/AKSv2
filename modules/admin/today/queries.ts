"use server";

import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";

import {
  db,
  designs,
  orderEvents,
  orderPayments,
  orders,
  payments,
} from "@aks/db";

import { can } from "@/modules/auth";
import { countFabricsBelowReorderPoint } from "@/modules/inventory";
import type { OrderStatus } from "@/modules/orders/constants";
import { isOrderAtRisk } from "@/modules/orders/status";

import { DESIGN_AWAITING_REVIEW_STATUSES } from "./constants";
import {
  buildTodayActionCards,
  emptyTodayActionCounts,
  type TodayActionCard,
} from "./action-cards";

export type { TodayActionCard } from "./action-cards";
export { DESIGN_AWAITING_REVIEW_STATUSES } from "./constants";

export type TodayStats = {
  ordersPlaced: number;
  revenueMinor: number;
  inProduction: number;
  dispatchedToday: number;
};

const IN_PRODUCTION_STATUSES = [
  "CUTTING",
  "STITCHING",
  "EMBROIDERY",
  "FINISHING",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
] as const satisfies readonly OrderStatus[];

const AT_RISK_TERMINAL: readonly OrderStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "WRITE_OFF",
  "DELIVERY_REFUSED",
];

const SHOP_TIME_ZONE = "Asia/Karachi";

export type TodayScreenData = {
  cards: TodayActionCard[];
  stats: TodayStats | null;
  allClear: boolean;
};

export function startOfTodayInShop(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return new Date(`${year}-${month}-${day}T00:00:00+05:00`);
}

export function endOfTodayInShop(now = new Date()): Date {
  const start = startOfTodayInShop(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

async function countOrdersByStatus(status: OrderStatus): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(orders)
    .where(eq(orders.status, status));
  return Number(row?.total ?? 0);
}

async function countOrdersAtRisk(): Promise<number> {
  const threshold = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      promisedShipDate: orders.promisedShipDate,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        sql`${orders.promisedShipDate} is not null`,
        lte(orders.promisedShipDate, threshold),
        sql`${orders.status} not in (${sql.join(
          AT_RISK_TERMINAL.map((s) => sql`${s}`),
          sql`, `,
        )})`,
      ),
    );

  return rows.filter((row) =>
    isOrderAtRisk({
      promisedShipDate: row.promisedShipDate,
      status: row.status as OrderStatus,
    }),
  ).length;
}

async function countBalanceDueOrders(): Promise<number> {
  const paidExpr = sql<number>`(
    coalesce((
      select sum(${orderPayments.amountMinor})
      from ${orderPayments}
      where ${orderPayments.orderId} = ${orders.id}
      and ${orderPayments.status} in ('SUCCEEDED', 'REFUNDED')
    ), 0)
    +
    coalesce((
      select sum(${payments.amountMinor})
      from ${payments}
      where ${payments.orderId} = ${orders.id}
      and ${payments.status} in ('SUCCEEDED', 'REFUNDED')
    ), 0)
  )`;

  const [row] = await db
    .select({ total: count() })
    .from(orders)
    .where(
      and(
        sql`${orders.balanceAmountMinor} > 0`,
        sql`${paidExpr} > 0`,
        sql`${paidExpr} < ${orders.totalMinor}`,
        sql`${orders.status} not in ('DRAFT', 'AWAITING_DEPOSIT', 'CANCELLED', 'REFUNDED', 'REFUND_PENDING')`,
      ),
    );

  return Number(row?.total ?? 0);
}

async function countBankTransfersAwaitingVerification(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(payments)
    .where(eq(payments.status, "AWAITING_VERIFICATION"));
  return Number(row?.total ?? 0);
}

async function countDesignsAwaitingReview(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(designs)
    .where(inArray(designs.status, [...DESIGN_AWAITING_REVIEW_STATUSES]));
  return Number(row?.total ?? 0);
}

async function getTodayOrderStats(start: Date, end: Date): Promise<TodayStats> {
  const [placedRow] = await db
    .select({
      total: count(),
      revenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.placedAt, start),
        lte(orders.placedAt, end),
        sql`${orders.status} <> 'DRAFT'`,
      ),
    );

  const [productionRow] = await db
    .select({ total: count() })
    .from(orders)
    .where(inArray(orders.status, [...IN_PRODUCTION_STATUSES]));

  const [dispatchedRow] = await db
    .select({ total: count() })
    .from(orderEvents)
    .where(
      and(
        eq(orderEvents.toStatus, "DISPATCHED"),
        gte(orderEvents.createdAt, start),
        lte(orderEvents.createdAt, end),
      ),
    );

  return {
    ordersPlaced: Number(placedRow?.total ?? 0),
    revenueMinor: Number(placedRow?.revenueMinor ?? 0),
    inProduction: Number(productionRow?.total ?? 0),
    dispatchedToday: Number(dispatchedRow?.total ?? 0),
  };
}

/**
 * Live Today screen payload — counts and stats filtered by caller permissions.
 */
export async function getTodayScreenData(
  granted: ReadonlySet<string>,
): Promise<TodayScreenData> {
  const counts = emptyTodayActionCounts();

  if (can(granted, "orders.view")) {
    const [
      awaitingConfirmation,
      measurementsUnverified,
      atRisk,
      balanceDue,
    ] = await Promise.all([
      countOrdersByStatus("AWAITING_DEPOSIT"),
      countOrdersByStatus("DEPOSIT_PAID"),
      countOrdersAtRisk(),
      countBalanceDueOrders(),
    ]);
    counts.awaitingConfirmation = awaitingConfirmation;
    counts.measurementsUnverified = measurementsUnverified;
    counts.atRisk = atRisk;
    counts.balanceDue = balanceDue;
  }

  if (can(granted, "fabric.view")) {
    counts.lowStock = await countFabricsBelowReorderPoint();
  }

  if (can(granted, "money.verify_payments")) {
    counts.bankTransfer = await countBankTransfersAwaitingVerification();
  }

  if (can(granted, "designs.view")) {
    counts.designsReview = await countDesignsAwaitingReview();
  }

  const cards = buildTodayActionCards(granted, counts);

  let stats: TodayStats | null = null;
  if (can(granted, "orders.view")) {
    const start = startOfTodayInShop();
    const end = endOfTodayInShop();
    stats = await getTodayOrderStats(start, end);
  }

  const allClear = cards.length > 0 && cards.every((card) => card.count === 0);

  return { cards, stats, allClear };
}

/** @internal exported for tests */
export const __todayQueryInternals = {
  countOrdersByStatus,
  countOrdersAtRisk,
  countBalanceDueOrders,
  countBankTransfersAwaitingVerification,
  countDesignsAwaitingReview,
  getTodayOrderStats,
  IN_PRODUCTION_STATUSES,
};
