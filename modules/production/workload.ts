import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db, productionJobs, staff } from "@aks/db";

export type StaffWorkloadRow = {
  staffId: string;
  staffName: string;
  role: string;
  capacityPerWeek: number;
  assignedThisWeek: number;
  overAssigned: boolean;
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

/** Jobs per karigar this week vs capacity — warns, never blocks. */
export async function computeStaffWorkload(
  now = new Date(),
): Promise<StaffWorkloadRow[]> {
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(weekStart);

  const karigars = await db
    .select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      capacityPerWeek: staff.capacityPerWeek,
    })
    .from(staff)
    .where(eq(staff.isActive, true))
    .orderBy(staff.name);

  const counts = await db
    .select({
      assignedToId: productionJobs.assignedToId,
      count: sql<number>`count(*)::int`,
    })
    .from(productionJobs)
    .where(
      and(
        sql`${productionJobs.assignedToId} IS NOT NULL`,
        gte(productionJobs.createdAt, weekStart),
        lte(productionJobs.createdAt, weekEnd),
        sql`${productionJobs.status} != 'DONE'`,
      ),
    )
    .groupBy(productionJobs.assignedToId);

  const countMap = new Map(
    counts.map((c) => [c.assignedToId, c.count] as const),
  );

  return karigars.map((k) => {
    const assignedThisWeek = countMap.get(k.id) ?? 0;
    return {
      staffId: k.id,
      staffName: k.name,
      role: k.role,
      capacityPerWeek: k.capacityPerWeek,
      assignedThisWeek,
      overAssigned: assignedThisWeek > k.capacityPerWeek,
    };
  });
}
