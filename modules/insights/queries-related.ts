"use server";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  customerMeasurementProfiles,
  customerMeasurements,
  customerProfiles,
  db,
  designCosts,
  designs,
  fabricLots,
  fabricReservations,
  fabrics,
  garmentCategories,
  messageLog,
  orderItems,
  orders,
  productionJobs,
  staff,
  suppliers,
  users,
} from "@aks/db";

import { requirePermission } from "@/modules/auth";
import { lotAvailableMeters } from "@/modules/inventory/lot-status";

const PLACED_STATUSES = sql`${orders.status} not in ('DRAFT', 'CANCELLED')`;

// ─── Customer list & related ───────────────────────────────────────────────

export type CustomerListItem = {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  totalOrdersCount: number;
  lifetimeValueMinor: number;
  createdAt: Date;
};

export async function listCustomers(query?: string): Promise<CustomerListItem[]> {
  await requirePermission("customers.view");

  const conditions = [
    eq(users.role, "CUSTOMER"),
    isNull(users.deletedAt),
  ];

  if (query?.trim()) {
    const term = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(users.name, term),
        ilike(users.email, term),
        ilike(users.phone, term),
      )!,
    );
  }

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      totalOrdersCount: sql<number>`coalesce(${customerProfiles.totalOrdersCount}, 0)::int`,
      lifetimeValueMinor: sql<number>`coalesce(${customerProfiles.lifetimeValueMinor}, 0)::int`,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(200);

  return rows;
}

export type CustomerOrderRow = {
  id: string;
  orderNumber: string;
  placedAt: Date | null;
  totalMinor: number;
  status: string;
};

export type CustomerMeasurementProfileRow = {
  id: string;
  label: string;
  categoryName: string;
  isDefault: boolean;
  measurementCount: number;
};

export type CustomerFabricRow = {
  fabricId: string;
  fabricName: string;
  totalMetersConsumed: number;
};

export type CustomerMessageRow = {
  id: string;
  templateKey: string;
  orderNumber: string | null;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
};

export type CustomerRelatedData = {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  lifetimeValueMinor: number;
  totalOrdersCount: number;
  orders: CustomerOrderRow[];
  measurementProfiles: CustomerMeasurementProfileRow[];
  fabricsPurchased: CustomerFabricRow[];
  messages: CustomerMessageRow[];
};

export async function getCustomerRelated(
  userId: string,
): Promise<CustomerRelatedData | null> {
  await requirePermission("customers.view");

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user) return null;

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      placedAt: orders.placedAt,
      totalMinor: orders.totalMinor,
      status: orders.status,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), PLACED_STATUSES))
    .orderBy(desc(orders.placedAt));

  const orderIds = orderRows.map((o) => o.id);

  const [profileRows, fabricRows, messageRows] = await Promise.all([
    db
      .select({
        id: customerMeasurementProfiles.id,
        label: customerMeasurementProfiles.label,
        categoryName: garmentCategories.name,
        isDefault: customerMeasurementProfiles.isDefault,
        measurementCount: sql<number>`(
          select count(*)::int from ${customerMeasurements}
          where ${customerMeasurements.profileId} = ${customerMeasurementProfiles.id}
        )`,
      })
      .from(customerMeasurementProfiles)
      .innerJoin(
        garmentCategories,
        eq(customerMeasurementProfiles.categoryId, garmentCategories.id),
      )
      .where(eq(customerMeasurementProfiles.userId, userId))
      .orderBy(desc(customerMeasurementProfiles.updatedAt)),

    orderIds.length > 0
      ? db
          .select({
            fabricId: fabricLots.fabricId,
            fabricName: sql<string>`(
              select f.name from fabrics f where f.id = ${fabricLots.fabricId}
            )`,
            totalMetersConsumed: sql<number>`coalesce(sum(
              coalesce(${fabricReservations.actualMetersConsumed}, ${fabricReservations.metersReserved})
            ), 0)::int`,
          })
          .from(fabricReservations)
          .innerJoin(
            orderItems,
            eq(fabricReservations.orderItemId, orderItems.id),
          )
          .innerJoin(fabricLots, eq(fabricReservations.fabricLotId, fabricLots.id))
          .where(
            and(
              inArray(orderItems.orderId, orderIds),
              inArray(fabricReservations.status, ["CONSUMED", "RESERVED"]),
            ),
          )
          .groupBy(fabricLots.fabricId)
      : Promise.resolve([]),

    orderIds.length > 0 || user.email
      ? db
          .select({
            id: messageLog.id,
            templateKey: messageLog.templateKey,
            orderNumber: orders.orderNumber,
            status: messageLog.status,
            sentAt: messageLog.sentAt,
            createdAt: messageLog.createdAt,
          })
          .from(messageLog)
          .leftJoin(orders, eq(messageLog.orderId, orders.id))
          .where(
            orderIds.length > 0 && user.email
              ? or(
                  inArray(messageLog.orderId, orderIds),
                  eq(messageLog.recipient, user.email),
                )
              : orderIds.length > 0
                ? inArray(messageLog.orderId, orderIds)
                : eq(messageLog.recipient, user.email!),
          )
          .orderBy(desc(messageLog.createdAt))
          .limit(50)
      : Promise.resolve([]),
  ]);

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    whatsappNumber: profile?.whatsappNumber ?? null,
    lifetimeValueMinor: profile?.lifetimeValueMinor ?? 0,
    totalOrdersCount: profile?.totalOrdersCount ?? orderRows.length,
    orders: orderRows,
    measurementProfiles: profileRows,
    fabricsPurchased: fabricRows.map((r) => ({
      fabricId: r.fabricId,
      fabricName: r.fabricName,
      totalMetersConsumed: r.totalMetersConsumed,
    })),
    messages: messageRows,
  };
}

// ─── Design related ────────────────────────────────────────────────────────

export type DesignOrderRow = {
  orderId: string;
  orderNumber: string;
  placedAt: Date | null;
  lineTotalMinor: number;
  quantity: number;
  customerName: string;
  customerUserId: string | null;
};

export type DesignCustomerRow = {
  userId: string;
  name: string | null;
  orderCount: number;
  revenueMinor: number;
};

export type DesignRelatedData = {
  designId: string;
  designName: string;
  orderCount: number;
  unitsSold: number;
  revenueMinor: number;
  marginPercent: number | null;
  fabricConsumedMeters: number;
  plannedFabricMeters: number;
  fabricName: string | null;
  orders: DesignOrderRow[];
  customers: DesignCustomerRow[];
};

export async function getDesignRelated(
  designId: string,
): Promise<DesignRelatedData | null> {
  await requirePermission("designs.view");

  const [design] = await db
    .select({ id: designs.id, name: designs.name })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);

  if (!design) return null;

  const [costRow, aggRow, orderRows, customerRows] = await Promise.all([
    db
      .select({
        marginPercent: designCosts.marginPercent,
        fabricMeters: designCosts.fabricMeters,
        fabricName: sql<string>`(
          select f.name from fabrics f where f.id = ${designCosts.fabricId}
        )`,
      })
      .from(designCosts)
      .where(eq(designCosts.designId, designId))
      .limit(1),

    db
      .select({
        orderCount: sql<number>`count(distinct ${orders.id})::int`,
        unitsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
        revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.designId, designId), PLACED_STATUSES)),

    db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        placedAt: orders.placedAt,
        lineTotalMinor: orderItems.lineTotalMinor,
        quantity: orderItems.quantity,
        customerName: sql<string>`coalesce(${users.name}, ${orders.shippingAddressSnapshot}->>'recipientName', 'Guest')`,
        customerUserId: orders.userId,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .where(and(eq(orderItems.designId, designId), PLACED_STATUSES))
      .orderBy(desc(orders.placedAt))
      .limit(50),

    db
      .select({
        userId: orders.userId,
        name: users.name,
        orderCount: sql<number>`count(distinct ${orders.id})::int`,
        revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .where(
        and(
          eq(orderItems.designId, designId),
          PLACED_STATUSES,
          isNotNull(orders.userId),
        ),
      )
      .groupBy(orders.userId, users.name)
      .orderBy(desc(sql`sum(${orderItems.lineTotalMinor})`))
      .limit(20),
  ]);

  const fabricConsumedRows = await db
    .select({
      total: sql<number>`coalesce(sum(
        coalesce(${fabricReservations.actualMetersConsumed}, ${fabricReservations.metersReserved})
      ), 0)::int`,
    })
    .from(fabricReservations)
    .innerJoin(orderItems, eq(fabricReservations.orderItemId, orderItems.id))
    .where(
      and(
        eq(orderItems.designId, designId),
        inArray(fabricReservations.status, ["CONSUMED", "RESERVED"]),
      ),
    );

  const unitsSold = aggRow[0]?.unitsSold ?? 0;
  const plannedPerUnit = costRow[0]?.fabricMeters ?? 0;

  return {
    designId: design.id,
    designName: design.name,
    orderCount: aggRow[0]?.orderCount ?? 0,
    unitsSold,
    revenueMinor: aggRow[0]?.revenueMinor ?? 0,
    marginPercent: costRow[0]?.marginPercent ?? null,
    fabricConsumedMeters: fabricConsumedRows[0]?.total ?? 0,
    plannedFabricMeters: plannedPerUnit * unitsSold,
    fabricName: costRow[0]?.fabricName ?? null,
    orders: orderRows.map((r) => ({
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      placedAt: r.placedAt,
      lineTotalMinor: r.lineTotalMinor,
      quantity: r.quantity,
      customerName: r.customerName,
      customerUserId: r.customerUserId,
    })),
    customers: customerRows
      .filter((r) => r.userId)
      .map((r) => ({
        userId: r.userId!,
        name: r.name,
        orderCount: r.orderCount,
        revenueMinor: r.revenueMinor,
      })),
  };
}

// ─── Fabric related ────────────────────────────────────────────────────────

export type FabricDesignRow = {
  designId: string;
  designName: string;
  fabricMeters: number;
  marginPercent: number;
};

export type FabricOrderRow = {
  orderId: string;
  orderNumber: string;
  metersConsumed: number;
  lotCode: string;
  placedAt: Date | null;
};

export type FabricCostHistoryRow = {
  lotCode: string;
  costPerMeterMinor: number;
  receivedAt: Date;
  metersReceived: number;
};

export type FabricRelatedData = {
  fabricId: string;
  fabricName: string;
  metresRemaining: number;
  supplierName: string | null;
  designs: FabricDesignRow[];
  orders: FabricOrderRow[];
  costHistory: FabricCostHistoryRow[];
};

export async function getFabricRelated(
  fabricId: string,
): Promise<FabricRelatedData | null> {
  await requirePermission("fabric.view");

  const [fabric] = await db
    .select({
      id: fabrics.id,
      name: fabrics.name,
      defaultSupplierId: fabrics.defaultSupplierId,
    })
    .from(fabrics)
    .where(eq(fabrics.id, fabricId))
    .limit(1);

  if (!fabric) return null;

  const [supplierRow, designRows, orderRows, costRows, lotRows] =
    await Promise.all([
      fabric.defaultSupplierId
        ? db
            .select({ name: suppliers.name })
            .from(suppliers)
            .where(eq(suppliers.id, fabric.defaultSupplierId))
            .limit(1)
        : Promise.resolve([]),

      db
        .select({
          designId: designCosts.designId,
          designName: designs.name,
          fabricMeters: designCosts.fabricMeters,
          marginPercent: designCosts.marginPercent,
        })
        .from(designCosts)
        .innerJoin(designs, eq(designCosts.designId, designs.id))
        .where(eq(designCosts.fabricId, fabricId))
        .orderBy(asc(designs.name)),

      db
        .select({
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          placedAt: orders.placedAt,
          lotCode: fabricLots.lotCode,
          metersConsumed: sql<number>`coalesce(
            ${fabricReservations.actualMetersConsumed},
            ${fabricReservations.metersReserved}
          )::int`,
        })
        .from(fabricReservations)
        .innerJoin(fabricLots, eq(fabricReservations.fabricLotId, fabricLots.id))
        .innerJoin(orderItems, eq(fabricReservations.orderItemId, orderItems.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(fabricLots.fabricId, fabricId),
            inArray(fabricReservations.status, ["CONSUMED", "RESERVED"]),
            PLACED_STATUSES,
          ),
        )
        .orderBy(desc(orders.placedAt))
        .limit(50),

      db
        .select({
          lotCode: fabricLots.lotCode,
          costPerMeterMinor: fabricLots.costPerMeterMinor,
          receivedAt: fabricLots.receivedAt,
          metersReceived: fabricLots.metersReceived,
        })
        .from(fabricLots)
        .where(eq(fabricLots.fabricId, fabricId))
        .orderBy(desc(fabricLots.receivedAt))
        .limit(20),

      db
        .select({
          metersOnHand: fabricLots.metersOnHand,
          metersReserved: fabricLots.metersReserved,
        })
        .from(fabricLots)
        .where(
          and(
            eq(fabricLots.fabricId, fabricId),
            inArray(fabricLots.status, ["AVAILABLE", "LOW"]),
          ),
        ),
    ]);

  const metresRemaining = lotRows.reduce(
    (sum, lot) => sum + lotAvailableMeters(lot),
    0,
  );

  return {
    fabricId: fabric.id,
    fabricName: fabric.name,
    metresRemaining,
    supplierName: supplierRow[0]?.name ?? null,
    designs: designRows,
    orders: orderRows,
    costHistory: costRows,
  };
}

// ─── Order fabric lots ─────────────────────────────────────────────────────

export type OrderFabricLotRow = {
  orderItemId: string;
  designName: string;
  lotCode: string;
  fabricId: string;
  fabricName: string;
  metersReserved: number;
  actualMetersConsumed: number | null;
  status: string;
};

export async function getOrderFabricLots(
  orderId: string,
): Promise<OrderFabricLotRow[]> {
  await requirePermission("orders.view");

  const rows = await db
    .select({
      orderItemId: orderItems.id,
      designName: sql<string>`${orderItems.designSnapshot}->>'name'`,
      lotCode: fabricLots.lotCode,
      fabricId: fabricLots.fabricId,
      fabricName: fabrics.name,
      metersReserved: fabricReservations.metersReserved,
      actualMetersConsumed: fabricReservations.actualMetersConsumed,
      status: fabricReservations.status,
    })
    .from(fabricReservations)
    .innerJoin(orderItems, eq(fabricReservations.orderItemId, orderItems.id))
    .innerJoin(fabricLots, eq(fabricReservations.fabricLotId, fabricLots.id))
    .innerJoin(fabrics, eq(fabricLots.fabricId, fabrics.id))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.createdAt);

  return rows;
}

// ─── Staff / karigar related ───────────────────────────────────────────────

export type StaffJobRow = {
  jobId: string;
  orderNumber: string;
  designName: string;
  stage: string;
  status: string;
  dueAt: Date | null;
};

export type StaffRelatedData = {
  linkedKarigarId: string | null;
  karigarName: string | null;
  assignedJobs: StaffJobRow[];
  completedThisMonth: number;
  activeJobs: number;
  capacityPerWeek: number;
  assignedThisWeek: number;
};

export async function getStaffRelated(userId: string): Promise<StaffRelatedData> {
  await requirePermission("staff.view");

  const [karigar] = await db
    .select({
      id: staff.id,
      name: staff.name,
      capacityPerWeek: staff.capacityPerWeek,
    })
    .from(staff)
    .where(eq(staff.userId, userId))
    .limit(1);

  if (!karigar) {
    return {
      linkedKarigarId: null,
      karigarName: null,
      assignedJobs: [],
      completedThisMonth: 0,
      activeJobs: 0,
      capacityPerWeek: 0,
      assignedThisWeek: 0,
    };
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const [jobRows, completedRow, activeRow, weekRow] = await Promise.all([
    db
      .select({
        jobId: productionJobs.id,
        orderNumber: orders.orderNumber,
        designName: sql<string>`${orderItems.designSnapshot}->>'name'`,
        stage: productionJobs.stage,
        status: productionJobs.status,
        dueAt: productionJobs.dueAt,
      })
      .from(productionJobs)
      .innerJoin(orderItems, eq(productionJobs.orderItemId, orderItems.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(productionJobs.assignedToId, karigar.id),
          ne(productionJobs.status, "DONE"),
        ),
      )
      .orderBy(productionJobs.dueAt)
      .limit(30),

    db
      .select({ count: count() })
      .from(productionJobs)
      .where(
        and(
          eq(productionJobs.assignedToId, karigar.id),
          eq(productionJobs.status, "DONE"),
          gte(productionJobs.updatedAt, monthStart),
        ),
      ),

    db
      .select({ count: count() })
      .from(productionJobs)
      .where(
        and(
          eq(productionJobs.assignedToId, karigar.id),
          ne(productionJobs.status, "DONE"),
        ),
      ),

    db
      .select({ count: count() })
      .from(productionJobs)
      .where(
        and(
          eq(productionJobs.assignedToId, karigar.id),
          gte(productionJobs.createdAt, weekStart),
          ne(productionJobs.status, "DONE"),
        ),
      ),
  ]);

  return {
    linkedKarigarId: karigar.id,
    karigarName: karigar.name,
    assignedJobs: jobRows,
    completedThisMonth: completedRow[0]?.count ?? 0,
    activeJobs: activeRow[0]?.count ?? 0,
    capacityPerWeek: karigar.capacityPerWeek,
    assignedThisWeek: weekRow[0]?.count ?? 0,
  };
}
