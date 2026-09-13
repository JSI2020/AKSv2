import { and, eq } from "drizzle-orm";

import { colourways, db, designs, rtwMovements, rtwStock } from "@aks/db";
import { STANDARD_SIZE_LABELS, uuidv7 } from "@aks/shared";

import type { DbTx } from "@/modules/platform/types";

import { RtwStockError } from "./types";

export type RtwStockRow = {
  id: string;
  designId: string;
  colourwayId: string;
  sizeLabel: string;
  quantityOnHand: number;
  quantityReserved: number;
};

export function rtwAvailable(row: Pick<RtwStockRow, "quantityOnHand" | "quantityReserved">): number {
  return Math.max(0, row.quantityOnHand - row.quantityReserved);
}

/** Ensure RTW stock row inside a transaction (no permission check). */
export async function ensureRtwStockRowTx(
  tx: DbTx,
  designId: string,
  colourwayId: string,
  sizeLabel: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await tx
    .select({ id: rtwStock.id })
    .from(rtwStock)
    .where(
      and(
        eq(rtwStock.designId, designId),
        eq(rtwStock.colourwayId, colourwayId),
        eq(rtwStock.sizeLabel, sizeLabel),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { id: existing[0].id, created: false };
  }

  const id = uuidv7();
  await tx.insert(rtwStock).values({
    id,
    designId,
    colourwayId,
    sizeLabel,
    quantityOnHand: 0,
    quantityReserved: 0,
    reorderPoint: 2,
  });
  return { id, created: true };
}

/**
 * Seed zero-qty RTW rows for every active colourway × size on a design.
 * Each shade uses its own availableSizeLabels; falls back to design labels.
 */
export async function seedRtwStockForDesign(
  tx: DbTx,
  designId: string,
  fallbackSizeLabels?: readonly string[],
): Promise<number> {
  const [design] = await tx
    .select({ availableSizeLabels: designs.availableSizeLabels })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);

  const designFallback =
    fallbackSizeLabels?.length
      ? [...fallbackSizeLabels]
      : design?.availableSizeLabels?.length
        ? [...design.availableSizeLabels]
        : [...STANDARD_SIZE_LABELS.filter((l) => l !== "XXL")];

  const cws = await tx
    .select({
      id: colourways.id,
      availableSizeLabels: colourways.availableSizeLabels,
    })
    .from(colourways)
    .where(and(eq(colourways.designId, designId), eq(colourways.active, true)));

  let created = 0;
  for (const cw of cws) {
    const labels =
      cw.availableSizeLabels?.length > 0
        ? cw.availableSizeLabels
        : designFallback;
    for (const label of labels) {
      const row = await ensureRtwStockRowTx(tx, designId, cw.id, label);
      if (row.created) created += 1;
    }
  }
  return created;
}

/** Record a RECEIVED movement and bump on-hand (script + internal use). */
export async function receiveRtwStockTx(
  tx: DbTx,
  stockId: string,
  quantity: number,
  actorId: string,
  note?: string | null,
): Promise<void> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Receive quantity must be a positive integer");
  }
  const [row] = await tx
    .select()
    .from(rtwStock)
    .where(eq(rtwStock.id, stockId))
    .limit(1);
  if (!row) throw new Error("RTW stock not found");

  await tx.insert(rtwMovements).values({
    id: uuidv7(),
    rtwStockId: stockId,
    delta: quantity,
    reason: "RECEIVED",
    note: note ?? null,
    actorId,
  });
  await tx
    .update(rtwStock)
    .set({
      quantityOnHand: row.quantityOnHand + quantity,
      updatedAt: new Date(),
    })
    .where(eq(rtwStock.id, stockId));
}

/**
 * Seed rows for all colourways × sizes, then receive opening stock where on-hand is zero.
 */
export async function seedAndReceiveRtwForDesign(
  tx: DbTx,
  designId: string,
  sizeLabels: readonly string[],
  receiveQty: number,
  actorId: string,
  note?: string,
): Promise<{ rowsCreated: number; unitsReceived: number }> {
  const rowsCreated = await seedRtwStockForDesign(tx, designId, sizeLabels);
  const stockRows = await tx
    .select({ id: rtwStock.id, quantityOnHand: rtwStock.quantityOnHand })
    .from(rtwStock)
    .where(eq(rtwStock.designId, designId));

  let unitsReceived = 0;
  for (const row of stockRows) {
    if (row.quantityOnHand > 0 || receiveQty <= 0) continue;
    await receiveRtwStockTx(tx, row.id, receiveQty, actorId, note);
    unitsReceived += receiveQty;
  }
  return { rowsCreated, unitsReceived };
}

export async function getRtwStockMapForDesign(
  designId: string,
): Promise<Record<string, Record<string, number>>> {
  const rows = await db
    .select({
      colourwayId: rtwStock.colourwayId,
      sizeLabel: rtwStock.sizeLabel,
      quantityOnHand: rtwStock.quantityOnHand,
      quantityReserved: rtwStock.quantityReserved,
    })
    .from(rtwStock)
    .where(eq(rtwStock.designId, designId));

  const map: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    if (!map[row.colourwayId]) map[row.colourwayId] = {};
    map[row.colourwayId]![row.sizeLabel] = rtwAvailable(row);
  }
  return map;
}

export async function getRtwStockRow(
  tx: DbTx,
  designId: string,
  colourwayId: string,
  sizeLabel: string,
): Promise<RtwStockRow | null> {
  const [row] = await tx
    .select()
    .from(rtwStock)
    .where(
      and(
        eq(rtwStock.designId, designId),
        eq(rtwStock.colourwayId, colourwayId),
        eq(rtwStock.sizeLabel, sizeLabel),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function rtwStockLineKey(
  designId: string,
  colourwayId: string,
  sizeLabel: string,
): string {
  return `${designId}:${colourwayId}:${sizeLabel.trim()}`;
}

/** Batch-resolve available units for cart / checkout lines. */
export async function getRtwAvailableByLine(
  lines: Array<{
    designId: string;
    colourwayId: string;
    sizeLabel: string;
  }>,
): Promise<Map<string, number>> {
  const designIds = [...new Set(lines.map((l) => l.designId))];
  const map = new Map<string, number>();
  if (!designIds.length) return map;

  const { inArray } = await import("drizzle-orm");
  const rows = await db
    .select({
      designId: rtwStock.designId,
      colourwayId: rtwStock.colourwayId,
      sizeLabel: rtwStock.sizeLabel,
      quantityOnHand: rtwStock.quantityOnHand,
      quantityReserved: rtwStock.quantityReserved,
    })
    .from(rtwStock)
    .where(inArray(rtwStock.designId, designIds));

  for (const row of rows) {
    map.set(
      rtwStockLineKey(row.designId, row.colourwayId, row.sizeLabel),
      rtwAvailable(row),
    );
  }
  return map;
}

export async function lockRtwStockRow(
  tx: DbTx,
  stockId: string,
): Promise<RtwStockRow | null> {
  const rows = await tx
    .select()
    .from(rtwStock)
    .where(eq(rtwStock.id, stockId))
    .for("update")
    .limit(1);
  return rows[0] ?? null;
}

/** Read-only availability check for cart / PDP (no lock). */
export async function checkRtwLineStock(params: {
  designId: string;
  colourwayId: string;
  sizeLabel: string;
  quantity: number;
}): Promise<{ ok: true; available: number } | { ok: false; error: string }> {
  const qty = Math.max(1, params.quantity);
  const [row] = await db
    .select({
      quantityOnHand: rtwStock.quantityOnHand,
      quantityReserved: rtwStock.quantityReserved,
    })
    .from(rtwStock)
    .where(
      and(
        eq(rtwStock.designId, params.designId),
        eq(rtwStock.colourwayId, params.colourwayId),
        eq(rtwStock.sizeLabel, params.sizeLabel),
      ),
    )
    .limit(1);

  if (!row) {
    return {
      ok: false,
      error: "This size is not in stock yet. Check back soon.",
    };
  }

  const available = rtwAvailable(row);
  if (available < qty) {
    return {
      ok: false,
      error:
        available <= 0
          ? `Size ${params.sizeLabel} is sold out.`
          : `Size ${params.sizeLabel} — only ${available} left.`,
    };
  }

  return { ok: true, available };
}

export async function assertRtwLineStock(
  tx: DbTx,
  params: {
    designId: string;
    colourwayId: string;
    sizeLabel: string;
    quantity: number;
  },
): Promise<RtwStockRow> {
  const row = await getRtwStockRow(
    tx,
    params.designId,
    params.colourwayId,
    params.sizeLabel,
  );
  if (!row) {
    throw new RtwStockError(
      `No inventory row for design ${params.designId} size ${params.sizeLabel}.`,
    );
  }

  const locked = await lockRtwStockRow(tx, row.id);
  if (!locked) {
    throw new RtwStockError("Inventory row could not be locked.");
  }

  const available = rtwAvailable(locked);
  if (available < params.quantity) {
    throw new RtwStockError(
      available <= 0
        ? `Size ${params.sizeLabel} is sold out.`
        : `Size ${params.sizeLabel} — only ${available} left.`,
    );
  }

  return locked;
}
