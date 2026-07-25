import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  colourways,
  fabricLots,
  fabricReservations,
  fabrics,
  orderItems,
  purchaseOrderLines,
  purchaseOrders,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { enqueue } from "@/modules/platform/outbox/enqueue";
import type { DbTx } from "@/modules/platform/types";

import { lotAvailableMeters, refreshFabricLotStatus } from "./lot-status";
import type { FabricAllocationResult } from "./types";

type LockedLot = {
  id: string;
  fabricId: string;
  lotCode: string;
  metersOnHand: number;
  metersReserved: number;
  status: string;
  receivedAt: Date;
};

async function lockFabricLot(
  tx: DbTx,
  lotId: string,
): Promise<LockedLot | null> {
  const rows = await tx
    .select({
      id: fabricLots.id,
      fabricId: fabricLots.fabricId,
      lotCode: fabricLots.lotCode,
      metersOnHand: fabricLots.metersOnHand,
      metersReserved: fabricLots.metersReserved,
      status: fabricLots.status,
      receivedAt: fabricLots.receivedAt,
    })
    .from(fabricLots)
    .where(eq(fabricLots.id, lotId))
    .for("update");

  return rows[0] ?? null;
}

async function findGroupLotId(
  tx: DbTx,
  groupKey: string,
  fabricId: string,
): Promise<string | null> {
  const [orderId] = groupKey.split(":");
  if (!orderId) return null;

  const rows = await tx
    .select({ fabricLotId: fabricReservations.fabricLotId })
    .from(fabricReservations)
    .innerJoin(orderItems, eq(fabricReservations.orderItemId, orderItems.id))
    .innerJoin(colourways, eq(orderItems.colourwayId, colourways.id))
    .where(
      and(
        eq(orderItems.orderId, orderId),
        eq(colourways.fabricId, fabricId),
        eq(fabricReservations.status, "RESERVED"),
      ),
    )
    .limit(1);

  return rows[0]?.fabricLotId ?? null;
}

async function listViableLots(
  tx: DbTx,
  fabricId: string,
  metersRequired: number,
): Promise<LockedLot[]> {
  const rows = await tx
    .select({
      id: fabricLots.id,
      fabricId: fabricLots.fabricId,
      lotCode: fabricLots.lotCode,
      metersOnHand: fabricLots.metersOnHand,
      metersReserved: fabricLots.metersReserved,
      status: fabricLots.status,
      receivedAt: fabricLots.receivedAt,
    })
    .from(fabricLots)
    .where(
      and(
        eq(fabricLots.fabricId, fabricId),
        eq(fabricLots.status, "AVAILABLE"),
        sql`${fabricLots.metersOnHand} - ${fabricLots.metersReserved} >= ${metersRequired}`,
      ),
    )
    .orderBy(asc(fabricLots.receivedAt))
    .for("update");

  return rows.filter(
    (lot) => lotAvailableMeters(lot) >= metersRequired,
  );
}

async function insertReservation(
  tx: DbTx,
  input: {
    fabricLotId: string;
    lotCode: string;
    orderItemId: string;
    metersRequired: number;
    fabricId: string;
  },
): Promise<FabricAllocationResult> {
  const lot = await lockFabricLot(tx, input.fabricLotId);
  if (!lot || lot.status !== "AVAILABLE") {
    return {
      status: "INSUFFICIENT",
      fabricId: input.fabricId,
      metersRequired: input.metersRequired,
      shortfall: input.metersRequired,
      candidateLotIds: [],
    };
  }

  const available = lotAvailableMeters(lot);
  if (available < input.metersRequired) {
    return {
      status: "INSUFFICIENT",
      fabricId: lot.fabricId,
      metersRequired: input.metersRequired,
      shortfall: input.metersRequired - available,
      candidateLotIds: [],
    };
  }

  const reservationId = uuidv7();
  await tx.insert(fabricReservations).values({
    id: reservationId,
    orderItemId: input.orderItemId,
    fabricLotId: lot.id,
    metersReserved: input.metersRequired,
    status: "RESERVED",
    reservedAt: new Date(),
  });

  await tx
    .update(fabricLots)
    .set({
      metersReserved: lot.metersReserved + input.metersRequired,
      updatedAt: new Date(),
    })
    .where(eq(fabricLots.id, lot.id));

  await refreshFabricLotStatus(tx, lot.id);
  await maybeEnqueueLowStockAlert(tx, lot.fabricId);

  return {
    status: "RESERVED",
    reservationId,
    fabricLotId: lot.id,
    lotCode: lot.lotCode,
    metersReserved: input.metersRequired,
  };
}

/**
 * Dye lots are not interchangeable — one lot must cover the whole requirement.
 * Match-group items share a lot where possible; otherwise FIFO among viable lots.
 */
export async function allocateFabric(
  input: {
    fabricId: string;
    metersRequired: number;
    orderItemId: string;
    groupKey?: string;
  },
  tx: DbTx,
): Promise<FabricAllocationResult> {
  if (input.metersRequired <= 0) {
    throw new Error("metersRequired must be positive.");
  }

  const groupKey = input.groupKey ?? input.orderItemId;

  const groupLotId = await findGroupLotId(tx, groupKey, input.fabricId);
  if (groupLotId) {
    const groupLot = await lockFabricLot(tx, groupLotId);
    if (
      groupLot &&
      groupLot.status === "AVAILABLE" &&
      lotAvailableMeters(groupLot) >= input.metersRequired
    ) {
      return insertReservation(tx, {
        fabricLotId: groupLot.id,
        lotCode: groupLot.lotCode,
        orderItemId: input.orderItemId,
        metersRequired: input.metersRequired,
        fabricId: input.fabricId,
      });
    }
  }

  const candidates = await listViableLots(
    tx,
    input.fabricId,
    input.metersRequired,
  );
  const chosen = candidates[0];

  if (!chosen) {
    const allLots = await tx
      .select({
        id: fabricLots.id,
        metersOnHand: fabricLots.metersOnHand,
        metersReserved: fabricLots.metersReserved,
      })
      .from(fabricLots)
      .where(
        and(
          eq(fabricLots.fabricId, input.fabricId),
          eq(fabricLots.status, "AVAILABLE"),
        ),
      );

    const lotAvailable = allLots.map((lot) => lotAvailableMeters(lot));
    const maxSingleLotAvailable = lotAvailable.reduce(
      (max, value) => Math.max(max, value),
      0,
    );

    return {
      status: "INSUFFICIENT",
      fabricId: input.fabricId,
      metersRequired: input.metersRequired,
      shortfall: Math.max(0, input.metersRequired - maxSingleLotAvailable),
      candidateLotIds: allLots.map((lot) => lot.id),
    };
  }

  return insertReservation(tx, {
    fabricLotId: chosen.id,
    lotCode: chosen.lotCode,
    orderItemId: input.orderItemId,
    metersRequired: input.metersRequired,
    fabricId: input.fabricId,
  });
}

async function sumFabricAvailableMeters(
  tx: DbTx,
  fabricId: string,
): Promise<number> {
  const lots = await tx
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

async function sumOpenPoMeters(tx: DbTx, fabricId: string): Promise<number> {
  const rows = await tx
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

export async function maybeEnqueueLowStockAlert(
  tx: DbTx,
  fabricId: string,
): Promise<void> {
  const [master] = await tx
    .select({
      name: fabrics.name,
      reorderPointMeters: fabrics.reorderPointMeters,
      reorderQuantityMeters: fabrics.reorderQuantityMeters,
      defaultSupplierId: fabrics.defaultSupplierId,
    })
    .from(fabrics)
    .where(eq(fabrics.id, fabricId))
    .limit(1);

  if (!master || master.reorderPointMeters <= 0) return;

  const available = await sumFabricAvailableMeters(tx, fabricId);
  const onOpenPos = await sumOpenPoMeters(tx, fabricId);
  const effectiveAvailable = available + onOpenPos;

  if (effectiveAvailable >= master.reorderPointMeters) return;

  await enqueue(
    "inventory.low_stock",
    {
      fabricId,
      fabricName: master.name,
      availableMeters: available,
      openPoMeters: onOpenPos,
      effectiveAvailableMeters: effectiveAvailable,
      reorderPointMeters: master.reorderPointMeters,
      suggestedReorderMeters: master.reorderQuantityMeters,
      defaultSupplierId: master.defaultSupplierId,
    },
    tx,
  );
}
