import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";

import {
  db,
  orderItems,
  orders,
  productionJobs,
  staff,
  users,
} from "@aks/db";

import {
  customerFirstName,
  daysToPromisedShip,
  isAtRisk,
  PRODUCTION_JOB_STAGES,
  PRODUCTION_STAGE_LABELS,
  sizeModeLabel,
  type ProductionJobStage,
} from "./constants";
import type { ProductionBoardFilters } from "./admin/search-params";

export type ProductionBoardCard = {
  id: string;
  orderNumber: string;
  customerFirstName: string;
  designName: string;
  thumbnailUrl: string | null;
  sizeModeLabel: "M" | "Custom";
  assignedToName: string | null;
  assignedToId: string | null;
  daysToShip: number | null;
  atRisk: boolean;
  status: string;
  stage: ProductionJobStage;
  blockedReason: string | null;
};

export type StaffOption = {
  id: string;
  name: string;
  role: string;
};

function emptyColumns(): Record<ProductionJobStage, ProductionBoardCard[]> {
  return PRODUCTION_JOB_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<ProductionJobStage, ProductionBoardCard[]>,
  );
}

export async function listProductionBoard(
  filters: ProductionBoardFilters,
  options: { tailorSafe?: boolean } = {},
): Promise<Record<ProductionJobStage, ProductionBoardCard[]>> {
  const conditions = [ne(productionJobs.stage, "PACKED" as const)];

  if (filters.stage?.length) {
    conditions.push(inArray(productionJobs.stage, filters.stage));
  }
  if (filters.staffId?.length) {
    conditions.push(inArray(productionJobs.assignedToId, filters.staffId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(productionJobs.dueAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(productionJobs.dueAt, filters.dateTo));
  }

  const rows = await db
    .select({
      id: productionJobs.id,
      stage: productionJobs.stage,
      status: productionJobs.status,
      dueAt: productionJobs.dueAt,
      blockedReason: productionJobs.blockedReason,
      assignedToId: productionJobs.assignedToId,
      assignedToName: staff.name,
      orderNumber: orders.orderNumber,
      recipientName: sql<string>`${orders.shippingAddressSnapshot}->>'recipientName'`,
      userName: users.name,
      designSnapshot: orderItems.designSnapshot,
      sizeMode: orderItems.sizeMode,
    })
    .from(productionJobs)
    .innerJoin(orderItems, eq(productionJobs.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(users, eq(orders.userId, users.id))
    .leftJoin(staff, eq(productionJobs.assignedToId, staff.id))
    .where(and(...conditions))
    .orderBy(productionJobs.dueAt);

  const columns = emptyColumns();
  const now = new Date();

  for (const row of rows) {
    const stage = row.stage as ProductionJobStage;
    const promised = row.dueAt;
    const days = daysToPromisedShip(promised, now);
    const atRisk = filters.atRisk === true ? isAtRisk(promised, stage, now) : isAtRisk(promised, stage, now);

    if (filters.atRisk === true && !atRisk) continue;
    if (
      filters.sizeMode?.length &&
      !filters.sizeMode.includes(row.sizeMode as "STANDARD" | "MADE_TO_MEASURE")
    ) {
      continue;
    }

    const card: ProductionBoardCard = {
      id: row.id,
      orderNumber: row.orderNumber,
      customerFirstName: options.tailorSafe
        ? customerFirstName(row.userName ?? row.recipientName)
        : customerFirstName(row.userName ?? row.recipientName),
      designName: row.designSnapshot.name,
      thumbnailUrl: row.designSnapshot.thumbnailUrl ?? null,
      sizeModeLabel: sizeModeLabel(
        row.sizeMode as "STANDARD" | "MADE_TO_MEASURE",
      ),
      assignedToName: row.assignedToName,
      assignedToId: row.assignedToId,
      daysToShip: days,
      atRisk,
      status: row.status,
      stage,
      blockedReason: row.blockedReason,
    };

    if (columns[stage]) {
      columns[stage].push(card);
    }
  }

  return columns;
}

export async function listActiveStaff(): Promise<StaffOption[]> {
  const rows = await db
    .select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
    })
    .from(staff)
    .where(eq(staff.isActive, true))
    .orderBy(staff.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
  }));
}

export { PRODUCTION_STAGE_LABELS };
