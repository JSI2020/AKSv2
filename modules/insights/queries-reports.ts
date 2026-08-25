"use server";

import { and, desc, eq, gt, gte, isNotNull, lte, sql, type SQL } from "drizzle-orm";

import {
  customerProfiles,
  db,
  designCosts,
  designs,
  fabricReservations,
  garmentCategories,
  orderEvents,
  orderItems,
  orders,
} from "@aks/db";

import { requirePermission } from "@/modules/auth";

const PLACED = sql`${orders.status} not in ('DRAFT', 'CANCELLED')`;

export type InsightsDateRange = {
  from?: Date;
  to?: Date;
};

export type SalesByDesignRow = {
  designId: string;
  designName: string;
  unitsSold: number;
  revenueMinor: number;
};

export type SalesByCategoryRow = {
  categoryId: string;
  categoryName: string;
  unitsSold: number;
  revenueMinor: number;
};

export type SalesByCityRow = {
  city: string;
  orderCount: number;
  revenueMinor: number;
};

export type SizeDistributionRow = {
  sizeLabel: string;
  sizeMode: string;
  unitsSold: number;
  orderCount: number;
};

export type AvgMeasurementRow = {
  measurementKey: string;
  avgValueInches: number;
  sampleCount: number;
};

export type SizeModeSplitRow = {
  sizeMode: string;
  unitsSold: number;
  revenueMinor: number;
  percentUnits: number;
};

export type LeadTimeRow = {
  orderId: string;
  orderNumber: string;
  promisedDays: number | null;
  actualDays: number | null;
  deltaDays: number | null;
  placedAt: Date | null;
};

export type FabricWastageRow = {
  designId: string;
  designName: string;
  plannedMeters: number;
  actualMeters: number;
  wastageMeters: number;
  wastagePercent: number;
};

export type InsightsReportData = {
  salesByDesign: SalesByDesignRow[];
  salesByCategory: SalesByCategoryRow[];
  salesByCity: SalesByCityRow[];
  sizeDistribution: SizeDistributionRow[];
  avgMeasurements: AvgMeasurementRow[];
  sizeModeSplit: SizeModeSplitRow[];
  leadTimes: LeadTimeRow[];
  fabricWastage: FabricWastageRow[];
  repeatCustomerRate: {
    totalCustomers: number;
    repeatCustomers: number;
    ratePercent: number;
  };
};

function placedWhere(range?: InsightsDateRange): SQL | undefined {
  const parts: SQL[] = [PLACED];
  if (range?.from) parts.push(gte(orders.placedAt, range.from));
  if (range?.to) parts.push(lte(orders.placedAt, range.to));
  return and(...parts);
}

export async function getInsightsReportData(
  range?: InsightsDateRange,
): Promise<InsightsReportData> {
  await requirePermission("insights.view");

  const [
    salesByDesign,
    salesByCategory,
    salesByCity,
    sizeDistribution,
    avgMeasurements,
    sizeModeSplitRaw,
    leadTimes,
    fabricWastage,
    repeatStats,
  ] = await Promise.all([
    loadSalesByDesign(range),
    loadSalesByCategory(range),
    loadSalesByCity(range),
    loadSizeDistribution(range),
    loadAvgMeasurements(range),
    loadSizeModeSplit(range),
    loadLeadTimes(range),
    loadFabricWastage(range),
    loadRepeatCustomerRate(),
  ]);

  const totalUnits = sizeModeSplitRaw.reduce((s, r) => s + r.unitsSold, 0);
  const sizeModeSplit = sizeModeSplitRaw.map((r) => ({
    ...r,
    percentUnits:
      totalUnits > 0 ? Math.round((r.unitsSold / totalUnits) * 10000) / 100 : 0,
  }));

  return {
    salesByDesign,
    salesByCategory,
    salesByCity,
    sizeDistribution,
    avgMeasurements,
    sizeModeSplit,
    leadTimes,
    fabricWastage,
    repeatCustomerRate: repeatStats,
  };
}

async function loadSalesByDesign(
  range?: InsightsDateRange,
): Promise<SalesByDesignRow[]> {
  const rows = await db
    .select({
      designId: orderItems.designId,
      designName: sql<string>`${orderItems.designSnapshot}->>'name'`,
      unitsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(placedWhere(range))
    .groupBy(orderItems.designId, sql`${orderItems.designSnapshot}->>'name'`)
    .orderBy(desc(sql`sum(${orderItems.lineTotalMinor})`));

  return rows;
}

async function loadSalesByCategory(
  range?: InsightsDateRange,
): Promise<SalesByCategoryRow[]> {
  const rows = await db
    .select({
      categoryId: designs.garmentTypeId,
      categoryName: garmentCategories.name,
      unitsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(designs, eq(orderItems.designId, designs.id))
    .innerJoin(garmentCategories, eq(designs.garmentTypeId, garmentCategories.id))
    .where(placedWhere(range))
    .groupBy(designs.garmentTypeId, garmentCategories.name)
    .orderBy(desc(sql`sum(${orderItems.lineTotalMinor})`));

  return rows;
}

async function loadSalesByCity(
  range?: InsightsDateRange,
): Promise<SalesByCityRow[]> {
  const rows = await db
    .select({
      city: sql<string>`${orders.shippingAddressSnapshot}->>'city'`,
      orderCount: sql<number>`count(distinct ${orders.id})::int`,
      revenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
    })
    .from(orders)
    .where(and(placedWhere(range), isNotNull(orders.placedAt)))
    .groupBy(sql`${orders.shippingAddressSnapshot}->>'city'`)
    .orderBy(desc(sql`sum(${orders.totalMinor})`));

  return rows.map((r) => ({
    city: r.city || "Unknown",
    orderCount: r.orderCount,
    revenueMinor: r.revenueMinor,
  }));
}

async function loadSizeDistribution(
  range?: InsightsDateRange,
): Promise<SizeDistributionRow[]> {
  const rows = await db
    .select({
      sizeLabel: sql<string>`coalesce(${orderItems.sizeLabel}, 'MTM')`,
      sizeMode: orderItems.sizeMode,
      unitsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      orderCount: sql<number>`count(distinct ${orders.id})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(placedWhere(range))
    .groupBy(orderItems.sizeMode, sql`coalesce(${orderItems.sizeLabel}, 'MTM')`)
    .orderBy(desc(sql`sum(${orderItems.quantity})`));

  return rows;
}

async function loadAvgMeasurements(
  range?: InsightsDateRange,
): Promise<AvgMeasurementRow[]> {
  const fromClause = range?.from
    ? sql`AND o.placed_at >= ${range.from}`
    : sql``;
  const toClause = range?.to ? sql`AND o.placed_at <= ${range.to}` : sql``;

  const rows = await db.execute<{
    measurement_key: string;
    avg_value: number;
    sample_count: number;
  }>(sql`
    SELECT
      key AS measurement_key,
      round(avg(val))::int AS avg_value,
      count(*)::int AS sample_count
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    CROSS JOIN LATERAL jsonb_each_text(
      CASE
        WHEN oi.measurement_snapshot IS NOT NULL
          AND oi.measurement_snapshot->'values' IS NOT NULL
        THEN oi.measurement_snapshot->'values'
        ELSE '{}'::jsonb
      END
    ) AS t(key, val)
    WHERE o.status NOT IN ('DRAFT', 'CANCELLED')
      AND oi.size_mode = 'MADE_TO_MEASURE'
      AND val ~ '^-?[0-9]+$'
      ${fromClause}
      ${toClause}
    GROUP BY key
    ORDER BY sample_count DESC
  `);

  return rows.map((r) => ({
    measurementKey: r.measurement_key,
    avgValueInches: r.avg_value,
    sampleCount: r.sample_count,
  }));
}

async function loadSizeModeSplit(
  range?: InsightsDateRange,
): Promise<Omit<SizeModeSplitRow, "percentUnits">[]> {
  const rows = await db
    .select({
      sizeMode: orderItems.sizeMode,
      unitsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(placedWhere(range))
    .groupBy(orderItems.sizeMode)
    .orderBy(desc(sql`sum(${orderItems.quantity})`));

  return rows.map((r) => ({
    sizeMode: r.sizeMode,
    unitsSold: r.unitsSold,
    revenueMinor: r.revenueMinor,
    percentUnits: 0,
  }));
}

async function loadLeadTimes(
  range?: InsightsDateRange,
): Promise<LeadTimeRow[]> {
  const rows = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      placedAt: orders.placedAt,
      promisedShipDate: orders.promisedShipDate,
    })
    .from(orders)
    .where(and(placedWhere(range), isNotNull(orders.placedAt)))
    .orderBy(desc(orders.placedAt))
    .limit(100);

  const result: LeadTimeRow[] = [];

  for (const row of rows) {
    const [dispatchEvent] = await db
      .select({ createdAt: orderEvents.createdAt })
      .from(orderEvents)
      .where(
        and(
          eq(orderEvents.entityId, row.orderId),
          sql`${orderEvents.toStatus} in ('DISPATCHED', 'DELIVERED', 'COMPLETED')`,
        ),
      )
      .orderBy(orderEvents.createdAt)
      .limit(1);

    const placedAt = row.placedAt!;
    const promisedDays = row.promisedShipDate
      ? Math.round(
          (row.promisedShipDate.getTime() - placedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    const actualDays = dispatchEvent
      ? Math.round(
          (dispatchEvent.createdAt.getTime() - placedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    result.push({
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      promisedDays,
      actualDays,
      deltaDays:
        promisedDays !== null && actualDays !== null
          ? actualDays - promisedDays
          : null,
      placedAt: row.placedAt,
    });
  }

  return result;
}

async function loadFabricWastage(
  range?: InsightsDateRange,
): Promise<FabricWastageRow[]> {
  const rows = await db
    .select({
      designId: orderItems.designId,
      designName: sql<string>`${orderItems.designSnapshot}->>'name'`,
      actualMeters: sql<number>`coalesce(sum(
        coalesce(${fabricReservations.actualMetersConsumed}, ${fabricReservations.metersReserved})
      ), 0)::int`,
      unitsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      plannedPerUnit: sql<number>`coalesce(max(${designCosts.fabricMeters}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(
      fabricReservations,
      eq(fabricReservations.orderItemId, orderItems.id),
    )
    .leftJoin(designCosts, eq(designCosts.designId, orderItems.designId))
    .where(
      and(
        placedWhere(range),
        sql`${fabricReservations.status} is null or ${fabricReservations.status} in ('CONSUMED', 'RESERVED')`,
      ),
    )
    .groupBy(orderItems.designId, sql`${orderItems.designSnapshot}->>'name'`)
    .orderBy(desc(sql`sum(
      coalesce(${fabricReservations.actualMetersConsumed}, ${fabricReservations.metersReserved})
    )`));

  return rows.map((r) => {
    const plannedMeters = r.plannedPerUnit * r.unitsSold;
    const wastageMeters = Math.max(0, r.actualMeters - plannedMeters);
    const wastagePercent =
      plannedMeters > 0
        ? Math.round((wastageMeters / plannedMeters) * 10000) / 100
        : 0;
    return {
      designId: r.designId,
      designName: r.designName,
      plannedMeters,
      actualMeters: r.actualMeters,
      wastageMeters,
      wastagePercent,
    };
  });
}

async function loadRepeatCustomerRate() {
  const [totals] = await db
    .select({
      totalCustomers: sql<number>`count(*)::int`,
      repeatCustomers: sql<number>`count(*) filter (where ${customerProfiles.totalOrdersCount} > 1)::int`,
    })
    .from(customerProfiles)
    .where(gt(customerProfiles.totalOrdersCount, 0));

  const total = totals?.totalCustomers ?? 0;
  const repeat = totals?.repeatCustomers ?? 0;

  return {
    totalCustomers: total,
    repeatCustomers: repeat,
    ratePercent: total > 0 ? Math.round((repeat / total) * 10000) / 100 : 0,
  };
}
