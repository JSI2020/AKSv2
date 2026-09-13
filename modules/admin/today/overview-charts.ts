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

function eachDayKeys(from: Date, to: Date, maxDays = 31): string[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && keys.length < maxDays) {
    keys.push(ymd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  // If range > maxDays, keep the most recent window ending at `to`.
  if (end > start) {
    const totalDays =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (totalDays > maxDays) {
      const trimmed: string[] = [];
      const c = new Date(end);
      for (let i = 0; i < maxDays; i++) {
        trimmed.unshift(ymd(c));
        c.setDate(c.getDate() - 1);
      }
      return trimmed;
    }
  }
  return keys;
}

/**
 * Dashboard visuals for the selected Overview range:
 * daily revenue/orders (capped at 31 days), top designs, category split.
 */
export async function getOverviewCharts(range: {
  from: Date;
  to: Date;
}): Promise<OverviewCharts> {
  const dayKeys = eachDayKeys(range.from, range.to, 31);
  const seriesFrom = new Date(`${dayKeys[0]}T00:00:00`);
  const seriesTo = range.to;

  const placedInRange = and(
    gte(orders.placedAt, range.from),
    lte(orders.placedAt, range.to),
  );

  const placedInSeries = and(
    gte(orders.placedAt, seriesFrom),
    lte(orders.placedAt, seriesTo),
  );

  const [dailyRaw, topDesigns, byCategory] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${orders.placedAt}, 'YYYY-MM-DD')`,
        revenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(placedInSeries)
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

  const byDay = new Map(dailyRaw.map((r) => [r.day, r]));
  const dailyRevenue: DailyPoint[] = dayKeys.map((key) => {
    const hit = byDay.get(key);
    return {
      day: key,
      revenueMinor: hit?.revenueMinor ?? 0,
      orders: hit?.orders ?? 0,
    };
  });

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
