import { and, eq, gt, inArray } from "drizzle-orm";

import {
  db,
  fabricLots,
  fabrics,
  purchaseOrderLines,
  purchaseOrders,
} from "@aks/db";

import { lotAvailableMeters } from "./lot-status";

async function sumFabricAvailableMeters(fabricId: string): Promise<number> {
  const lots = await db
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
    );

  return lots.reduce((sum, lot) => sum + lotAvailableMeters(lot), 0);
}

async function sumOpenPoMeters(fabricId: string): Promise<number> {
  const rows = await db
    .select({
      metersOrdered: purchaseOrderLines.metersOrdered,
      metersReceived: purchaseOrderLines.metersReceived,
    })
    .from(purchaseOrderLines)
    .innerJoin(
      purchaseOrders,
      eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id),
    )
    .where(
      and(
        eq(purchaseOrderLines.fabricId, fabricId),
        inArray(purchaseOrders.status, ["SENT", "PARTIALLY_RECEIVED"]),
      ),
    );

  return rows.reduce(
    (sum, row) => sum + (row.metersOrdered - row.metersReceived),
    0,
  );
}

export type LowStockFabric = {
  id: string;
  name: string;
  availableMeters: number;
  openPoMeters: number;
  effectiveAvailableMeters: number;
  reorderPointMeters: number;
};

/** Fabrics whose effective available metres are below the reorder point. */
export async function listFabricsBelowReorderPoint(): Promise<LowStockFabric[]> {
  const masters = await db
    .select({
      id: fabrics.id,
      name: fabrics.name,
      reorderPointMeters: fabrics.reorderPointMeters,
    })
    .from(fabrics)
    .where(and(eq(fabrics.active, true), gt(fabrics.reorderPointMeters, 0)));

  const low: LowStockFabric[] = [];
  for (const master of masters) {
    const available = await sumFabricAvailableMeters(master.id);
    const openPoMeters = await sumOpenPoMeters(master.id);
    const effectiveAvailableMeters = available + openPoMeters;
    if (effectiveAvailableMeters < master.reorderPointMeters) {
      low.push({
        id: master.id,
        name: master.name,
        availableMeters: available,
        openPoMeters,
        effectiveAvailableMeters,
        reorderPointMeters: master.reorderPointMeters,
      });
    }
  }

  return low.sort((a, b) => a.name.localeCompare(b.name));
}

export async function countFabricsBelowReorderPoint(): Promise<number> {
  const rows = await listFabricsBelowReorderPoint();
  return rows.length;
}
