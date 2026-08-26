import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import {
  db,
  designs,
  garmentCategories,
  orderItems,
  orders,
} from "@aks/db";

export type DailyPoint = { day: string; revenueMinor: number; orders: number };
export type NamedValue = { name: string; revenueMinor: number; units: number };

export type OverviewCharts = {
  dailyRevenue: DailyPoint[];
  topDesigns: NamedValue[];
  byCategory: NamedValue[];
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Dashboard visuals: a trailing 14-day revenue/orders trend (independent of the
 * picker so it always tells a story), plus top designs and category split for
 * the selected range.
 */
export async function getOverviewCharts(range: {
  from: Date;
  to: Date;
}): Promise<OverviewCharts> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 13);
  start.setHours(0, 0, 0, 0);

  const placedInRange = and(
    gte(orders.placedAt, range.from),
    lte(orders.placedAt, range.to),
  );

  const [dailyRaw, topDesigns, byCategory] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${orders.placedAt}, 'YYYY-MM-DD')`,
        revenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(gte(orders.placedAt, start))
      .groupBy(sql`to_char(${orders.placedAt}, 'YYYY-MM-DD')`),
    db
      .select({
        name: sql<string>`${orderItems.designSnapshot}->>'name'`,
        revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)::int`,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(placedInRange)
      .groupBy(sql`${orderItems.designSnapshot}->>'name'`)
      .orderBy(desc(sql`sum(${orderItems.lineTotalMinor})`))
      .limit(5),
    db
      .select({
        name: garmentCategories.name,
        revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)::int`,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(designs, eq(orderItems.designId, designs.id))
      .innerJoin(garmentCategories, eq(designs.garmentTypeId, garmentCategories.id))
      .where(placedInRange)
      .groupBy(garmentCategories.name)
      .orderBy(desc(sql`sum(${orderItems.lineTotalMinor})`))
      .limit(6),
  ]);

  // Fill every day in the trailing window so the trend has no gaps.
  const byDay = new Map(dailyRaw.map((r) => [r.day, r]));
  const dailyRevenue: DailyPoint[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = ymd(d);
    const hit = byDay.get(key);
    dailyRevenue.push({
      day: key,
      revenueMinor: hit?.revenueMinor ?? 0,
      orders: hit?.orders ?? 0,
    });
  }

  return {
    dailyRevenue,
    topDesigns: topDesigns.map((r) => ({
      name: r.name || "Untitled",
      revenueMinor: r.revenueMinor,
      units: r.units,
    })),
    byCategory: byCategory.map((r) => ({
      name: r.name,
      revenueMinor: r.revenueMinor,
      units: r.units,
    })),
  };
}
