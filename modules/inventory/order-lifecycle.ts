import { and, eq } from "drizzle-orm";

import {
  colourways,
  designs,
  fabricLots,
  fabricReservations,
  orderItems,
  stockAdjustments,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import type { TransitionActor } from "@/modules/platform/transition";
import type { DbTx } from "@/modules/platform/types";

import { allocateFabric, maybeEnqueueLowStockAlert } from "./allocate-fabric";
import { lotAvailableMeters, refreshFabricLotStatus } from "./lot-status";
import { FabricAllocationError, FabricStockError } from "./types";

async function lockFabricLotRow(tx: DbTx, lotId: string) {
  const rows = await tx
    .select({
      id: fabricLots.id,
      metersOnHand: fabricLots.metersOnHand,
      metersReserved: fabricLots.metersReserved,
      fabricId: fabricLots.fabricId,
    })
    .from(fabricLots)
    .where(eq(fabricLots.id, lotId))
    .for("update");

  return rows[0] ?? null;
}

export async function reserveFabricForOrder(
  orderId: string,
  tx: DbTx,
): Promise<void> {
  const items = await tx
    .select({
      id: orderItems.id,
      designId: orderItems.designId,
      colourwayId: orderItems.colourwayId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    const existing = await tx
      .select({ id: fabricReservations.id })
      .from(fabricReservations)
      .where(
        and(
          eq(fabricReservations.orderItemId, item.id),
          eq(fabricReservations.status, "RESERVED"),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    const [design] = await tx
      .select({ fabricConsumptionMeters: designs.fabricConsumptionMeters })
      .from(designs)
      .where(eq(designs.id, item.designId))
      .limit(1);

    const [colourway] = await tx
      .select({ fabricId: colourways.fabricId })
      .from(colourways)
      .where(eq(colourways.id, item.colourwayId))
      .limit(1);

    if (!design || !colourway) {
      throw new FabricStockError("Order item missing design or colourway.");
    }

    const metersRequired = design.fabricConsumptionMeters * item.quantity;
    if (metersRequired <= 0) continue;

    const result = await allocateFabric(
      {
        fabricId: colourway.fabricId,
        metersRequired,
        orderItemId: item.id,
        groupKey: orderId,
      },
      tx,
    );

    if (result.status === "INSUFFICIENT") {
      throw new FabricAllocationError(
        `Insufficient fabric stock for order item ${item.id}: need ${result.metersRequired} hundredths of a metre, short by ${result.shortfall}.`,
      );
    }
  }
}

export async function releaseFabricForOrder(
  orderId: string,
  tx: DbTx,
): Promise<void> {
  const reservationRows = await tx
    .select({
      id: fabricReservations.id,
      fabricLotId: fabricReservations.fabricLotId,
      metersReserved: fabricReservations.metersReserved,
      fabricId: fabricLots.fabricId,
    })
    .from(fabricReservations)
    .innerJoin(orderItems, eq(fabricReservations.orderItemId, orderItems.id))
    .innerJoin(fabricLots, eq(fabricReservations.fabricLotId, fabricLots.id))
    .where(
      and(
        eq(orderItems.orderId, orderId),
        eq(fabricReservations.status, "RESERVED"),
      ),
    );

  for (const reservation of reservationRows) {
    const lot = await lockFabricLotRow(tx, reservation.fabricLotId);
    if (!lot) continue;

    await tx
      .update(fabricReservations)
      .set({
        status: "RELEASED",
        releasedAt: new Date(),
      })
      .where(eq(fabricReservations.id, reservation.id));

    await tx
      .update(fabricLots)
      .set({
        metersReserved: lot.metersReserved - reservation.metersReserved,
        updatedAt: new Date(),
      })
      .where(eq(fabricLots.id, lot.id));

    await refreshFabricLotStatus(tx, lot.id);
    await maybeEnqueueLowStockAlert(tx, reservation.fabricId);
  }
}

export async function consumeFabricAtCutting(
  input: {
    orderId: string;
    actor: TransitionActor;
    actualMetersByOrderItemId?: Record<string, number>;
  },
  tx: DbTx,
): Promise<void> {
  const reservationRows = await tx
    .select({
      reservationId: fabricReservations.id,
      orderItemId: fabricReservations.orderItemId,
      fabricLotId: fabricReservations.fabricLotId,
      metersReserved: fabricReservations.metersReserved,
      designId: orderItems.designId,
      quantity: orderItems.quantity,
    })
    .from(fabricReservations)
    .innerJoin(orderItems, eq(fabricReservations.orderItemId, orderItems.id))
    .where(
      and(
        eq(orderItems.orderId, input.orderId),
        eq(fabricReservations.status, "RESERVED"),
      ),
    );

  for (const row of reservationRows) {
    const [design] = await tx
      .select({ fabricConsumptionMeters: designs.fabricConsumptionMeters })
      .from(designs)
      .where(eq(designs.id, row.designId))
      .limit(1);

    const estimated = (design?.fabricConsumptionMeters ?? 0) * row.quantity;
    const actual =
      input.actualMetersByOrderItemId?.[row.orderItemId] ?? estimated;

    if (actual <= 0) {
      throw new FabricStockError(
        `Actual metres consumed must be positive for order item ${row.orderItemId}.`,
      );
    }

    const lot = await lockFabricLotRow(tx, row.fabricLotId);
    if (!lot) {
      throw new FabricStockError(`Fabric lot ${row.fabricLotId} not found.`);
    }

    if (lotAvailableMeters(lot) + row.metersReserved < actual) {
      throw new FabricStockError(
        `Lot ${row.fabricLotId} cannot cover ${actual} hundredths of a metre at cutting.`,
      );
    }

    await tx
      .update(fabricReservations)
      .set({
        status: "CONSUMED",
        consumedAt: new Date(),
        actualMetersConsumed: actual,
      })
      .where(eq(fabricReservations.id, row.reservationId));

    await tx
      .update(fabricLots)
      .set({
        metersOnHand: lot.metersOnHand - actual,
        metersReserved: lot.metersReserved - row.metersReserved,
        updatedAt: new Date(),
      })
      .where(eq(fabricLots.id, lot.id));

    const wastage = actual - estimated;
    if (wastage > 0) {
      await tx.insert(stockAdjustments).values({
        id: uuidv7(),
        fabricLotId: lot.id,
        deltaMeters: -wastage,
        reason: "CUTTING_WASTE",
        note: `Cutting wastage: actual ${actual} vs estimated ${estimated} hundredths of a metre`,
        actorId: input.actor.id,
      });
    }

    await refreshFabricLotStatus(tx, lot.id);
    await maybeEnqueueLowStockAlert(tx, lot.fabricId);
  }
}
