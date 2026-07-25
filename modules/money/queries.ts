import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import {
  db,
  designCosts,
  designs,
  fabrics,
  orderItems,
  orderPayments,
  orders,
  payments,
  rates,
  recurringCosts,
} from "@aks/db";

import { requirePermission, userHasPermission } from "@/modules/auth";
import { listOutstandingCodOrders } from "@/modules/payments/cod/queries";
import { startOfTodayInShop } from "@/modules/admin/today/queries";

import {
  computeDesignCost,
  monthlyAmountMinor,
  type RateRow,
  type RecurringCostCycle,
} from "./compute";
import { aiCostMinorForDesign } from "./queries-internal";

export type DesignCostingData = {
  designId: string;
  basePriceMinor: number;
  fabrics: { id: string; name: string; costPerMeterMinor: number }[];
  rates: RateRow[];
  saved: {
    fabricId: string;
    fabricMeters: number;
    embroideryRateId: string | null;
    embroideryFlatMinor: number | null;
    stitchingRateId: string | null;
    stitchingFlatMinor: number | null;
    packagingMinor: number;
    sellingPriceMinor: number;
  } | null;
  aiCostMinor: number;
  breakdown: ReturnType<typeof computeDesignCost> | null;
};

export async function getDesignCostingData(
  designId: string,
): Promise<DesignCostingData> {
  await requirePermission("money.view");

  const [design] = await db
    .select({
      id: designs.id,
      basePriceMinor: designs.basePriceMinor,
    })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);

  if (!design) throw new Error("Design not found");

  const [fabricRows, rateRows, savedRow, aiCostMinor] = await Promise.all([
    db
      .select({
        id: fabrics.id,
        name: fabrics.name,
        costPerMeterMinor: fabrics.costPerMeterMinor,
      })
      .from(fabrics)
      .where(eq(fabrics.active, true))
      .orderBy(asc(fabrics.name)),
    db
      .select()
      .from(rates)
      .where(eq(rates.active, true))
      .orderBy(asc(rates.kind), asc(rates.name)),
    db
      .select()
      .from(designCosts)
      .where(eq(designCosts.designId, designId))
      .limit(1),
    aiCostMinorForDesign(designId),
  ]);

  const ratesList: RateRow[] = rateRows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    amountMinor: r.amountMinor,
    unit: r.unit,
  }));
  const ratesById = new Map(ratesList.map((r) => [r.id, r]));

  const saved = savedRow[0]
    ? {
        fabricId: savedRow[0].fabricId,
        fabricMeters: savedRow[0].fabricMeters,
        embroideryRateId: savedRow[0].embroideryRateId,
        embroideryFlatMinor: savedRow[0].embroideryFlatMinor,
        stitchingRateId: savedRow[0].stitchingRateId,
        stitchingFlatMinor: savedRow[0].stitchingFlatMinor,
        packagingMinor: savedRow[0].packagingMinor,
        sellingPriceMinor: savedRow[0].sellingPriceMinor,
      }
    : null;

  let breakdown: ReturnType<typeof computeDesignCost> | null = null;
  if (saved) {
    const fabric = fabricRows.find((f) => f.id === saved.fabricId);
    if (fabric) {
      breakdown = computeDesignCost({
        fabricCostPerMeterMinor: fabric.costPerMeterMinor,
        fabricMeters: saved.fabricMeters,
        embroideryRateId: saved.embroideryRateId,
        embroideryFlatMinor: saved.embroideryFlatMinor,
        stitchingRateId: saved.stitchingRateId,
        stitchingFlatMinor: saved.stitchingFlatMinor,
        packagingMinor: saved.packagingMinor,
        aiCostMinor,
        sellingPriceMinor: saved.sellingPriceMinor,
        ratesById,
      });
    }
  }

  return {
    designId,
    basePriceMinor: design.basePriceMinor,
    fabrics: fabricRows,
    rates: ratesList,
    saved,
    aiCostMinor,
    breakdown,
  };
}

export type RecurringCostRow = {
  id: string;
  name: string;
  category: string;
  amountMinor: number;
  cycle: RecurringCostCycle;
  monthlyMinor: number;
  active: boolean;
};

export type RevenuePeriod = {
  label: string;
  revenueMinor: number;
  orderCount: number;
};

export type MarginRankRow = {
  id: string;
  label: string;
  revenueMinor: number;
  costMinor: number;
  marginMinor: number;
  marginPercent: number;
};

export type MoneyDashboardData = {
  recurringCosts: RecurringCostRow[];
  monthlyFixedMinor: number;
  revenue: {
    today: RevenuePeriod;
    week: RevenuePeriod;
    month: RevenuePeriod;
  };
  depositsReceivedMinor: number;
  balancesOutstandingMinor: number;
  outstandingCod: Awaited<ReturnType<typeof listOutstandingCodOrders>>;
  outstandingCodTotalMinor: number;
  designMargins: MarginRankRow[];
  orderMargins: MarginRankRow[];
  breakEven: {
    monthlyFixedMinor: number;
    monthContributionMinor: number;
    avgContributionPerOrderMinor: number;
    ordersNeeded: number;
    message: string;
  };
  showMargin: boolean;
};

function periodBounds(now = new Date()) {
  const monthStart = startOfTodayInShop(now);
  monthStart.setDate(1);

  const weekStart = startOfTodayInShop(now);
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);

  const todayStart = startOfTodayInShop(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  return { todayStart, todayEnd, weekStart, monthStart, now };
}

async function revenueForRange(start: Date, end: Date): Promise<RevenuePeriod> {
  const [row] = await db
    .select({
      total: countRevenue(),
      revenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.placedAt, start),
        lte(orders.placedAt, end),
        sql`${orders.status} not in ('DRAFT', 'CANCELLED', 'REFUNDED')`,
      ),
    );

  return {
    label: "",
    revenueMinor: Number(row?.revenueMinor ?? 0),
    orderCount: Number(row?.total ?? 0),
  };
}

function countRevenue() {
  return sql<number>`count(*)::int`;
}

export async function getMoneyDashboardData(): Promise<MoneyDashboardData> {
  const session = await requirePermission("money.view");
  const showMargin = await userHasPermission(
    session.user.id,
    "money.view_margin",
  );

  const { todayStart, todayEnd, weekStart, monthStart, now } = periodBounds();

  const recurringRows = await db
    .select()
    .from(recurringCosts)
    .where(eq(recurringCosts.active, true))
    .orderBy(asc(recurringCosts.category), asc(recurringCosts.name));

  const recurringCostsList: RecurringCostRow[] = recurringRows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    amountMinor: row.amountMinor,
    cycle: row.cycle,
    monthlyMinor: monthlyAmountMinor(row.amountMinor, row.cycle),
    active: row.active,
  }));

  const monthlyFixedMinor = recurringCostsList.reduce(
    (sum, row) => sum + row.monthlyMinor,
    0,
  );

  const [today, week, month, depositRow, balanceRow, outstandingCod] =
    await Promise.all([
      revenueForRange(todayStart, todayEnd),
      revenueForRange(weekStart, now),
      revenueForRange(monthStart, now),
      sumSucceededPayments(["DEPOSIT", "FULL"], monthStart, now),
      sumOutstandingBalances(),
      listOutstandingCodOrders(),
    ]);

  today.label = "Today";
  week.label = "This week";
  month.label = "This month";

  const outstandingCodTotalMinor = outstandingCod.reduce(
    (sum, row) => sum + row.balanceMinor,
    0,
  );

  let designMargins: MarginRankRow[] = [];
  let orderMargins: MarginRankRow[] = [];
  let breakEven = {
    monthlyFixedMinor,
    monthContributionMinor: 0,
    avgContributionPerOrderMinor: 0,
    ordersNeeded: 0,
    message: "Add recurring costs and completed orders to see break-even.",
  };

  if (showMargin) {
    designMargins = await rankedDesignMargins();
    orderMargins = await rankedOrderMargins(monthStart, now);
    breakEven = computeBreakEven(
      monthlyFixedMinor,
      orderMargins,
      month.orderCount,
    );
  }

  return {
    recurringCosts: recurringCostsList,
    monthlyFixedMinor,
    revenue: { today, week, month },
    depositsReceivedMinor: depositRow,
    balancesOutstandingMinor: balanceRow,
    outstandingCod,
    outstandingCodTotalMinor,
    designMargins,
    orderMargins,
    breakEven,
    showMargin,
  };
}

async function sumSucceededPayments(
  kinds: ("DEPOSIT" | "BALANCE" | "FULL")[],
  start: Date,
  end: Date,
): Promise<number> {
  const [providerRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
    })
    .from(payments)
    .where(
      and(
        inArray(payments.kind, kinds),
        eq(payments.status, "SUCCEEDED"),
        gte(payments.createdAt, start),
        lte(payments.createdAt, end),
      ),
    );

  const [manualRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderPayments.amountMinor}), 0)::int`,
    })
    .from(orderPayments)
    .where(
      and(
        inArray(orderPayments.kind, kinds),
        eq(orderPayments.status, "SUCCEEDED"),
        gte(orderPayments.createdAt, start),
        lte(orderPayments.createdAt, end),
      ),
    );

  return Number(providerRow?.total ?? 0) + Number(manualRow?.total ?? 0);
}

async function sumOutstandingBalances(): Promise<number> {
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
    .select({
      total: sql<number>`coalesce(sum(${orders.totalMinor} - ${paidExpr}), 0)::int`,
    })
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

async function rankedDesignMargins(): Promise<MarginRankRow[]> {
  const rows = await db
    .select({
      designId: designCosts.designId,
      name: designs.name,
      totalCostMinor: designCosts.totalCostMinor,
      sellingPriceMinor: designCosts.sellingPriceMinor,
      marginPercent: designCosts.marginPercent,
    })
    .from(designCosts)
    .innerJoin(designs, eq(designCosts.designId, designs.id))
    .where(sql`${designCosts.sellingPriceMinor} > 0`);

  return rows
    .map((row) => ({
      id: row.designId,
      label: row.name,
      revenueMinor: row.sellingPriceMinor,
      costMinor: row.totalCostMinor,
      marginMinor: row.sellingPriceMinor - row.totalCostMinor,
      marginPercent: row.marginPercent,
    }))
    .sort((a, b) => b.marginPercent - a.marginPercent);
}

async function rankedOrderMargins(
  monthStart: Date,
  now: Date,
): Promise<MarginRankRow[]> {
  const orderRows = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      totalMinor: orders.totalMinor,
    })
    .from(orders)
    .where(
      and(
        gte(orders.placedAt, monthStart),
        lte(orders.placedAt, now),
        inArray(orders.status, [
          "DEPOSIT_PAID",
          "MEASUREMENTS_CONFIRMED",
          "CUTTING",
          "STITCHING",
          "EMBROIDERY",
          "FINISHING",
          "QUALITY_CHECK",
          "READY_TO_SHIP",
          "DISPATCHED",
          "DELIVERED",
          "COMPLETED",
        ]),
      ),
    );

  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.orderId);
  const itemRows = await db
    .select({
      orderId: orderItems.orderId,
      designId: orderItems.designId,
      quantity: orderItems.quantity,
      lineTotalMinor: orderItems.lineTotalMinor,
      totalCostMinor: designCosts.totalCostMinor,
    })
    .from(orderItems)
    .leftJoin(designCosts, eq(orderItems.designId, designCosts.designId))
    .where(inArray(orderItems.orderId, orderIds));

  const costByOrder = new Map<string, number>();
  const revenueByOrder = new Map<string, number>();
  const labelByOrder = new Map(
    orderRows.map((o) => [o.orderId, o.orderNumber] as const),
  );

  for (const order of orderRows) {
    revenueByOrder.set(order.orderId, order.totalMinor);
    costByOrder.set(order.orderId, 0);
  }

  for (const item of itemRows) {
    const unitCost = item.totalCostMinor ?? 0;
    const lineCost = unitCost * item.quantity;
    costByOrder.set(
      item.orderId,
      (costByOrder.get(item.orderId) ?? 0) + lineCost,
    );
  }

  return orderRows
    .map((order) => {
      const revenueMinor = revenueByOrder.get(order.orderId) ?? 0;
      const costMinor = costByOrder.get(order.orderId) ?? 0;
      const marginMinor = revenueMinor - costMinor;
      const marginPercent =
        revenueMinor > 0
          ? Math.round((marginMinor * 10_000) / revenueMinor)
          : 0;
      return {
        id: order.orderId,
        label: labelByOrder.get(order.orderId) ?? order.orderId,
        revenueMinor,
        costMinor,
        marginMinor,
        marginPercent,
      };
    })
    .sort((a, b) => b.marginMinor - a.marginMinor);
}

function computeBreakEven(
  monthlyFixedMinor: number,
  orderMargins: MarginRankRow[],
  monthOrderCount: number,
): MoneyDashboardData["breakEven"] {
  const monthContributionMinor = orderMargins.reduce(
    (sum, row) => sum + row.marginMinor,
    0,
  );
  const avgContributionPerOrderMinor =
    orderMargins.length > 0
      ? Math.round(monthContributionMinor / orderMargins.length)
      : 0;

  if (monthlyFixedMinor <= 0) {
    return {
      monthlyFixedMinor,
      monthContributionMinor,
      avgContributionPerOrderMinor,
      ordersNeeded: 0,
      message: "No recurring fixed costs recorded yet.",
    };
  }

  if (avgContributionPerOrderMinor <= 0) {
    return {
      monthlyFixedMinor,
      monthContributionMinor,
      avgContributionPerOrderMinor,
      ordersNeeded: 0,
      message:
        "Contribution margin per order is not positive yet — check design costing.",
    };
  }

  const shortfall = monthlyFixedMinor - monthContributionMinor;
  if (shortfall <= 0) {
    return {
      monthlyFixedMinor,
      monthContributionMinor,
      avgContributionPerOrderMinor,
      ordersNeeded: 0,
      message: `You are above break-even this month (${monthOrderCount} orders).`,
    };
  }

  const ordersNeeded = Math.ceil(shortfall / avgContributionPerOrderMinor);
  return {
    monthlyFixedMinor,
    monthContributionMinor,
    avgContributionPerOrderMinor,
    ordersNeeded,
    message: `You need ${ordersNeeded} more order${ordersNeeded === 1 ? "" : "s"} this month to break even.`,
  };
}

export async function listActiveRates(): Promise<RateRow[]> {
  await requirePermission("money.view");
  const rows = await db
    .select()
    .from(rates)
    .where(eq(rates.active, true))
    .orderBy(asc(rates.kind), asc(rates.name));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    amountMinor: r.amountMinor,
    unit: r.unit,
  }));
}
