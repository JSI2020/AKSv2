import { and, eq } from "drizzle-orm";

import { orderItems, rtwMovements, rtwStock } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import type { DbTx } from "@/modules/platform/types";

import {
  assertRtwLineStock,
  lockRtwStockRow,
} from "./rtw-stock";
import { RtwStockError } from "./types";

type StandardOrderItem = {
  id: string;
  designId: string;
  colourwayId: string;
  sizeMode: string;
  sizeLabel: string | null;
  quantity: number;
};

async function loadStandardItems(
  orderId: string,
  tx: DbTx,
): Promise<StandardOrderItem[]> {
  const items = await tx
    .select({
      id: orderItems.id,
      designId: orderItems.designId,
      colourwayId: orderItems.colourwayId,
      sizeMode: orderItems.sizeMode,
      sizeLabel: orderItems.sizeLabel,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  return items.filter(
    (item) => item.sizeMode === "STANDARD" && Boolean(item.sizeLabel?.trim()),
  );
}

/** Hold RTW units when an order is placed (DRAFT → AWAITING_DEPOSIT). */
export async function reserveRtwForOrder(
  orderId: string,
  tx: DbTx,
): Promise<void> {
  const items = await loadStandardItems(orderId, tx);

  for (const item of items) {
    const sizeLabel = item.sizeLabel!.trim();
    const locked = await assertRtwLineStock(tx, {
      designId: item.designId,
      colourwayId: item.colourwayId,
      sizeLabel,
      quantity: item.quantity,
    });

    await tx
      .update(rtwStock)
      .set({
        quantityReserved: locked.quantityReserved + item.quantity,
        updatedAt: new Date(),
      })
      .where(eq(rtwStock.id, locked.id));
  }
}

/** Release RTW holds when an order is cancelled or refunded. */
export async function releaseRtwForOrder(
  orderId: string,
  tx: DbTx,
): Promise<void> {
  const items = await loadStandardItems(orderId, tx);

  for (const item of items) {
    const sizeLabel = item.sizeLabel!.trim();
    const [row] = await tx
      .select()
      .from(rtwStock)
      .where(
        and(
          eq(rtwStock.designId, item.designId),
          eq(rtwStock.colourwayId, item.colourwayId),
          eq(rtwStock.sizeLabel, sizeLabel),
        ),
      )
      .limit(1);

    if (!row) continue;

    const locked = await lockRtwStockRow(tx, row.id);
    if (!locked) continue;

    const releaseQty = Math.min(item.quantity, locked.quantityReserved);
    if (releaseQty <= 0) continue;

    await tx
      .update(rtwStock)
      .set({
        quantityReserved: locked.quantityReserved - releaseQty,
        updatedAt: new Date(),
      })
      .where(eq(rtwStock.id, locked.id));
  }
}

/** Decrement on-hand RTW when pieces leave the warehouse (→ DISPATCHED). */
export async function consumeRtwForOrder(
  orderId: string,
  tx: DbTx,
): Promise<void> {
  const items = await loadStandardItems(orderId, tx);

  for (const item of items) {
    const sizeLabel = item.sizeLabel!.trim();
    const [row] = await tx
      .select()
      .from(rtwStock)
      .where(
        and(
          eq(rtwStock.designId, item.designId),
          eq(rtwStock.colourwayId, item.colourwayId),
          eq(rtwStock.sizeLabel, sizeLabel),
        ),
      )
      .limit(1);

    if (!row) {
      throw new RtwStockError(
        `Missing RTW stock row for order item ${item.id} (${sizeLabel}).`,
      );
    }

    const locked = await lockRtwStockRow(tx, row.id);
    if (!locked) {
      throw new RtwStockError(`Could not lock RTW stock for item ${item.id}.`);
    }

    if (locked.quantityOnHand < item.quantity) {
      throw new RtwStockError(
        `Insufficient on-hand stock for size ${sizeLabel} at dispatch.`,
      );
    }

    const reservedRelease = Math.min(item.quantity, locked.quantityReserved);

    await tx
      .update(rtwStock)
      .set({
        quantityOnHand: locked.quantityOnHand - item.quantity,
        quantityReserved: locked.quantityReserved - reservedRelease,
        updatedAt: new Date(),
      })
      .where(eq(rtwStock.id, locked.id));

    await tx.insert(rtwMovements).values({
      id: uuidv7(),
      rtwStockId: locked.id,
      delta: -item.quantity,
      reason: "ORDER_DISPATCH",
      orderId,
      note: `Order dispatch · size ${sizeLabel}`,
      actorId: null,
    });
  }
}
