"use server";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  db,
  fabricColourways,
  fabricLots,
  insertAuditLog,
  packingMaterials,
  packingMovements,
  rtwMovements,
  rtwStock,
  stockAdjustments,
  trimMovements,
  trimStock,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { refreshFabricLotStatus } from "@/modules/inventory/lot-status";

import {
  deltaFromMovementType,
  fabricAdjustReason,
  type ManualMovementType,
} from "./ledger-types";

export type RecordMovementResult =
  | { ok: true }
  | { ok: false; error: string };

export async function recordStockMovement(input: {
  stockKind: "rtw" | "fabric" | "packing" | "trim";
  stockId: string;
  type: ManualMovementType;
  /** pcs, or hundredths of a metre for fabric. */
  quantity: number;
  correctionSign?: "+" | "-";
  note?: string | null;
}): Promise<RecordMovementResult> {
  try {
    const session = await requirePermission(
      input.stockKind === "fabric" ? "fabric.adjust_stock" : "inventory.adjust",
    );

    let signedQty = input.quantity;
    if (input.type === "COUNT_CORRECTION") {
      const mag = Math.abs(input.quantity);
      signedQty = input.correctionSign === "-" ? -mag : mag;
    }

    const delta =
      input.type === "COUNT_CORRECTION"
        ? signedQty
        : deltaFromMovementType(input.type, Math.abs(input.quantity));

    if (input.stockKind === "rtw") {
      await applyUnitMovement({
        kind: "rtw",
        stockId: input.stockId,
        delta,
        reason: input.type,
        note: input.note ?? null,
        actorId: session.user.id,
        actorRole: session.user.role,
      });
    } else if (input.stockKind === "packing") {
      await applyUnitMovement({
        kind: "packing",
        stockId: input.stockId,
        delta,
        reason: input.type,
        note: input.note ?? null,
        actorId: session.user.id,
        actorRole: session.user.role,
      });
    } else if (input.stockKind === "trim") {
      await applyUnitMovement({
        kind: "trim",
        stockId: input.stockId,
        delta,
        reason: input.type,
        note: input.note ?? null,
        actorId: session.user.id,
        actorRole: session.user.role,
      });
    } else {
      await applyFabricColourMovement({
        colourwayId: input.stockId,
        deltaMeters: delta,
        type: input.type,
        note: input.note ?? null,
        actorId: session.user.id,
        actorRole: session.user.role,
      });
    }

    revalidatePath("/admin/inventory", "layout");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Movement failed",
    };
  }
}

async function applyUnitMovement(args: {
  kind: "rtw" | "packing" | "trim";
  stockId: string;
  delta: number;
  reason: ManualMovementType;
  note: string | null;
  actorId: string;
  actorRole: string;
}) {
  await db.transaction(async (tx) => {
    if (args.kind === "rtw") {
      const [row] = await tx
        .select()
        .from(rtwStock)
        .where(eq(rtwStock.id, args.stockId))
        .limit(1);
      if (!row) throw new Error("RTW stock not found");
      const next = row.quantityOnHand + args.delta;
      if (next < 0) throw new Error("Insufficient on-hand stock");
      await tx.insert(rtwMovements).values({
        id: uuidv7(),
        rtwStockId: args.stockId,
        delta: args.delta,
        reason: args.reason,
        note: args.note,
        actorId: args.actorId,
      });
      await tx
        .update(rtwStock)
        .set({ quantityOnHand: next, updatedAt: new Date() })
        .where(eq(rtwStock.id, args.stockId));
    } else if (args.kind === "packing") {
      const [row] = await tx
        .select()
        .from(packingMaterials)
        .where(eq(packingMaterials.id, args.stockId))
        .limit(1);
      if (!row) throw new Error("Packing material not found");
      const next = row.quantityOnHand + args.delta;
      if (next < 0) throw new Error("Insufficient on-hand stock");
      await tx.insert(packingMovements).values({
        id: uuidv7(),
        packingMaterialId: args.stockId,
        delta: args.delta,
        reason: args.reason,
        note: args.note,
        actorId: args.actorId,
      });
      await tx
        .update(packingMaterials)
        .set({ quantityOnHand: next, updatedAt: new Date() })
        .where(eq(packingMaterials.id, args.stockId));
    } else {
      const [row] = await tx
        .select()
        .from(trimStock)
        .where(eq(trimStock.id, args.stockId))
        .limit(1);
      if (!row) throw new Error("Trim stock not found");
      const next = row.quantityOnHand + args.delta;
      if (next < 0) throw new Error("Insufficient on-hand stock");
      await tx.insert(trimMovements).values({
        id: uuidv7(),
        trimStockId: args.stockId,
        delta: args.delta,
        reason: args.reason,
        note: args.note,
        actorId: args.actorId,
      });
      await tx
        .update(trimStock)
        .set({ quantityOnHand: next, updatedAt: new Date() })
        .where(eq(trimStock.id, args.stockId));
    }

    await insertAuditLog(tx as never, {
      id: uuidv7(),
      actorId: args.actorId,
      actorRole: args.actorRole,
      action: `inventory.${args.kind}.movement`,
      entityType: `${args.kind}_stock`,
      entityId: args.stockId,
      before: null,
      after: { delta: args.delta, reason: args.reason, note: args.note },
    });
  });
}

async function applyFabricColourMovement(args: {
  colourwayId: string;
  deltaMeters: number;
  type: ManualMovementType;
  note: string | null;
  actorId: string;
  actorRole: string;
}) {
  const [cw] = await db
    .select()
    .from(fabricColourways)
    .where(eq(fabricColourways.id, args.colourwayId))
    .limit(1);
  if (!cw) throw new Error("Fabric colourway not found");

  const lots = await db
    .select()
    .from(fabricLots)
    .where(
      and(
        eq(fabricLots.fabricId, cw.fabricId),
        eq(fabricLots.colourwayId, args.colourwayId),
        inArray(fabricLots.status, ["AVAILABLE", "LOW"]),
      ),
    )
    .orderBy(asc(fabricLots.receivedAt));

  let lot = lots[0];
  if (!lot && args.deltaMeters > 0) {
    // Opening stock into a synthetic lot for this colour
    const id = uuidv7();
    await db.insert(fabricLots).values({
      id,
      fabricId: cw.fabricId,
      colourwayId: args.colourwayId,
      lotCode: `OPEN-${cw.colourName.slice(0, 8)}-${id.slice(0, 4)}`,
      metersReceived: args.deltaMeters,
      metersOnHand: 0,
      metersReserved: 0,
      costPerMeterMinor: 0,
      receivedAt: new Date(),
      colourNotes: cw.colourName,
      status: "AVAILABLE",
    });
    const created = await db
      .select()
      .from(fabricLots)
      .where(eq(fabricLots.id, id))
      .limit(1);
    lot = created[0];
  }
  if (!lot) throw new Error("No lot for this colour — receive stock first");

  const next = lot.metersOnHand + args.deltaMeters;
  if (next < 0) throw new Error("Insufficient on-hand metres");

  await db.transaction(async (tx) => {
    await tx.insert(stockAdjustments).values({
      id: uuidv7(),
      fabricLotId: lot!.id,
      deltaMeters: args.deltaMeters,
      reason: fabricAdjustReason(args.type),
      note: args.note,
      actorId: args.actorId,
    });
    await tx
      .update(fabricLots)
      .set({
        metersOnHand: next,
        metersReceived:
          args.deltaMeters > 0
            ? lot!.metersReceived + args.deltaMeters
            : lot!.metersReceived,
        updatedAt: new Date(),
      })
      .where(eq(fabricLots.id, lot!.id));

    await insertAuditLog(tx as never, {
      id: uuidv7(),
      actorId: args.actorId,
      actorRole: args.actorRole,
      action: "inventory.fabric.movement",
      entityType: "fabric_colourway",
      entityId: args.colourwayId,
      before: { metersOnHand: lot!.metersOnHand },
      after: { metersOnHand: next, deltaMeters: args.deltaMeters },
    });

    await refreshFabricLotStatus(tx as never, lot!.id);
  });
}

/** Ensure a trim stock row exists (no colour or for a colourway). */
export async function ensureTrimStockRow(
  trimId: string,
  trimColourwayId: string | null,
): Promise<string> {
  await requirePermission("inventory.view");
  const existing = await db
    .select({ id: trimStock.id })
    .from(trimStock)
    .where(
      and(
        eq(trimStock.trimId, trimId),
        trimColourwayId
          ? eq(trimStock.trimColourwayId, trimColourwayId)
          : isNull(trimStock.trimColourwayId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = uuidv7();
  await db.insert(trimStock).values({
    id,
    trimId,
    trimColourwayId,
    quantityOnHand: 0,
    quantityReserved: 0,
    reorderPoint: 0,
  });
  return id;
}

/** Ensure RTW stock row for design×colourway×size. */
export async function ensureRtwStockRow(
  designId: string,
  colourwayId: string,
  sizeLabel: string,
): Promise<string> {
  await requirePermission("inventory.view");
  const existing = await db
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
  if (existing[0]) return existing[0].id;
  const id = uuidv7();
  await db.insert(rtwStock).values({
    id,
    designId,
    colourwayId,
    sizeLabel,
    quantityOnHand: 0,
    quantityReserved: 0,
    reorderPoint: 2,
  });
  return id;
}

export async function sumMovementDeltas(
  table: "rtw" | "packing" | "trim",
  stockId: string,
): Promise<number> {
  if (table === "rtw") {
    const [row] = await db
      .select({ s: sql<number>`coalesce(sum(${rtwMovements.delta}), 0)` })
      .from(rtwMovements)
      .where(eq(rtwMovements.rtwStockId, stockId));
    return Number(row?.s ?? 0);
  }
  if (table === "packing") {
    const [row] = await db
      .select({
        s: sql<number>`coalesce(sum(${packingMovements.delta}), 0)`,
      })
      .from(packingMovements)
      .where(eq(packingMovements.packingMaterialId, stockId));
    return Number(row?.s ?? 0);
  }
  const [row] = await db
    .select({ s: sql<number>`coalesce(sum(${trimMovements.delta}), 0)` })
    .from(trimMovements)
    .where(eq(trimMovements.trimStockId, stockId));
  return Number(row?.s ?? 0);
}
