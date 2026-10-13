import { and, count, eq, gte, gt, inArray, lte, sql } from "drizzle-orm";

import {
  customerProfiles,
  db,
  designCosts,
  designs,
  orderEvents,
  rtwStock,
  orderPayments,
  orders,
  payments,
} from "@aks/db";

import { can } from "@/modules/auth";
import {
  countFabricStockAlert,
  countFabricsBelowReorderPoint,
} from "@/modules/inventory";
import type { OrderStatus } from "@/modules/orders/constants";
import { isOrderAtRisk } from "@/modules/orders/status";

import { DESIGN_AWAITING_REVIEW_STATUSES } from "./constants";
import {
  buildTodayActionCards,
  emptyTodayActionCounts,
  type TodayActionCard,
} from "./action-cards";
import { parseOverviewRange, type OverviewRange } from "./overview-range";

export type { TodayActionCard } from "./action-cards";
export { DESIGN_AWAITING_REVIEW_STATUSES } from "./constants";
export {
  endOfTodayInShop,
  parseOverviewRange,
  startOfTodayInShop,
  type OverviewRange,
} from "./overview-range";

export type TodayStats = {
  ordersPlaced: number;
  revenueMinor: number;
  inProduction: number;
  /** Dispatched within the selected range (not only calendar today). */
  dispatchedInRange: number;
};

/** House health tiles under the revenue / pipeline band. */
export type OverviewSummary = {
  publishedDesigns: number;
  activeCustomers: number;
  /** Average design margin in hundredths of a percent (1933 → 19.33%). */
  avgMarginPercent: number | null;
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

export type StockAlert = {
  /** Published designs with a size at zero. */
  designsOut: number;
  /** Published designs with a size above zero and at or under reorder. */
  designsLow: number;
  fabricsOut: number;
  fabricsLow: number;
};

export type TodayScreenData = {
  cards: TodayActionCard[];
  stats: TodayStats | null;
  summary: OverviewSummary;
  allClear: boolean;
  stockAlert: StockAlert;
  range: OverviewRange;
};

const EMPTY_STOCK_ALERT: StockAlert = {
  designsOut: 0,
  designsLow: 0,
  fabricsOut: 0,
  fabricsLow: 0,
};

async function countDesignStockAlert(): Promise<
  Pick<StockAlert, "designsOut" | "designsLow">
> {
  const rows = await db
    .select({
      designId: rtwStock.designId,
      onHand: rtwStock.quantityOnHand,
      reorder: rtwStock.reorderPoint,
    })
    .from(rtwStock)
    .innerJoin(designs, eq(designs.id, rtwStock.designId))
    .where(eq(designs.status, "PUBLISHED"));

  const byDesign = new Map<string, { out: boolean; low: boolean }>();
  for (const row of rows) {
    const current = byDesign.get(row.designId) ?? { out: false, low: false };
    if (row.onHand <= 0) current.out = true;
    else if (row.onHand <= row.reorder) current.low = true;
    byDesign.set(row.designId, current);
  }

  let designsOut = 0;
  let designsLow = 0;
  for (const flags of byDesign.values()) {
    if (flags.out) designsOut += 1;
    else if (flags.low) designsLow += 1;
  }
  return { designsOut, designsLow };
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

async function getOverviewOrderStats(
  start: Date,
  end: Date,
): Promise<TodayStats> {
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
    dispatchedInRange: Number(dispatchedRow?.total ?? 0),
  };
}

async function getOverviewSummary(
  granted: ReadonlySet<string>,
): Promise<OverviewSummary> {
  const publishedDesigns = can(granted, "designs.view")
    ? await (async () => {
        const [row] = await db
          .select({ total: count() })
          .from(designs)
          .where(eq(designs.status, "PUBLISHED"));
        return Number(row?.total ?? 0);
      })()
    : 0;

  const activeCustomers = can(granted, "customers.view")
    ? await (async () => {
        const [row] = await db
          .select({ total: count() })
          .from(customerProfiles)
          .where(gt(customerProfiles.totalOrdersCount, 0));
        return Number(row?.total ?? 0);
      })()
    : 0;

  let avgMarginPercent: number | null = null;
  if (can(granted, "money.view") || can(granted, "designs.view")) {
    const [row] = await db
      .select({
        avg: sql<number | null>`round(avg(${designCosts.marginPercent}))::int`,
      })
      .from(designCosts)
      .where(gt(designCosts.sellingPriceMinor, 0));
    avgMarginPercent =
      row?.avg === null || row?.avg === undefined ? null : Number(row.avg);
  }

  return { publishedDesigns, activeCustomers, avgMarginPercent };
}

/** @deprecated alias — tests */
const getTodayOrderStats = getOverviewOrderStats;

/**
 * Overview screen payload — attention cards are live; numbers respect range.
 */
export async function getTodayScreenData(
  granted: ReadonlySet<string>,
  rangeInput?: { from?: string; to?: string },
): Promise<TodayScreenData> {
  const range = parseOverviewRange(rangeInput ?? {});
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

  const [stats, summary] = await Promise.all([
    can(granted, "orders.view")
      ? getOverviewOrderStats(range.from, range.to)
      : Promise.resolve(null),
    getOverviewSummary(granted),
  ]);

  const stockAlert: StockAlert = { ...EMPTY_STOCK_ALERT };
  if (can(granted, "designs.view") || can(granted, "inventory.view")) {
    const designStock = await countDesignStockAlert();
    stockAlert.designsOut = designStock.designsOut;
    stockAlert.designsLow = designStock.designsLow;
  }
  if (can(granted, "fabric.view") || can(granted, "inventory.view")) {
    const fabricStock = await countFabricStockAlert();
    stockAlert.fabricsOut = fabricStock.outOfStock;
    stockAlert.fabricsLow = fabricStock.belowReorder;
  }

  const stockOpen =
    stockAlert.designsOut +
      stockAlert.designsLow +
      stockAlert.fabricsOut +
      stockAlert.fabricsLow >
    0;
  const allClear =
    cards.length > 0 &&
    cards.every((card) => card.count === 0) &&
    !stockOpen;

  return { cards, stats, summary, allClear, stockAlert, range };
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
