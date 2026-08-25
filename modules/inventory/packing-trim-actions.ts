"use server";

import { revalidatePath } from "next/cache";

import {
  db,
  insertAuditLog,
  packingMaterials,
  packingMovements,
  trimColourways,
  trimMovements,
  trimStock,
  trims,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";

import { TRIM_KINDS, type TrimKind } from "./packing-trim-shared";

export type InventoryCreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createPackingMaterial(input: {
  name: string;
  reorderPoint?: number;
  /** Already converted to paisa by the form, or pass via costPerUnitMinor. */
  costPerUnitMinor?: number;
  openingQty?: number;
}): Promise<InventoryCreateResult> {
  try {
    const session = await requirePermission("inventory.adjust");
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name is required" };

    const reorderPoint = input.reorderPoint ?? 0;
    const openingQty = input.openingQty ?? 0;
    const costPerUnitMinor = input.costPerUnitMinor ?? 0;

    if (
      !Number.isInteger(reorderPoint) ||
      reorderPoint < 0 ||
      !Number.isInteger(openingQty) ||
      openingQty < 0 ||
      !Number.isInteger(costPerUnitMinor) ||
      costPerUnitMinor < 0
    ) {
      return { ok: false, error: "Quantities and cost must be whole numbers ≥ 0" };
    }

    const id = uuidv7();
    await db.transaction(async (tx) => {
      await tx.insert(packingMaterials).values({
        id,
        name,
        quantityOnHand: openingQty,
        quantityReserved: 0,
        reorderPoint,
        costPerUnitMinor,
        active: true,
      });

      if (openingQty > 0) {
        await tx.insert(packingMovements).values({
          id: uuidv7(),
          packingMaterialId: id,
          delta: openingQty,
          reason: "RECEIVED",
          note: "Opening stock",
          actorId: session.user.id,
        });
      }

      await insertAuditLog(tx as never, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "inventory.packing.create",
        entityType: "packing_material",
        entityId: id,
        before: null,
        after: { name, reorderPoint, openingQty, costPerUnitMinor },
      });
    });

    revalidatePath("/admin/inventory", "layout");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create failed",
    };
  }
}

export async function createTrim(input: {
  name: string;
  kind: TrimKind;
  hasColourVariants: boolean;
  reorderPoint?: number;
  costPerUnitMinor?: number;
  /** Used when no colour variants. */
  openingQty?: number;
  /** Colour rows when hasColourVariants. */
  colours?: { name: string; hex?: string; openingQty?: number }[];
}): Promise<InventoryCreateResult> {
  try {
    const session = await requirePermission("inventory.adjust");
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name is required" };
    if (!TRIM_KINDS.includes(input.kind)) {
      return { ok: false, error: "Invalid trim kind" };
    }

    const reorderPoint = input.reorderPoint ?? 0;
    const costPerUnitMinor = input.costPerUnitMinor ?? 0;
    if (
      !Number.isInteger(reorderPoint) ||
      reorderPoint < 0 ||
      !Number.isInteger(costPerUnitMinor) ||
      costPerUnitMinor < 0
    ) {
      return { ok: false, error: "Reorder and cost must be whole numbers ≥ 0" };
    }

    const colours = (input.colours ?? [])
      .map((c) => ({
        name: c.name.trim(),
        hex: c.hex?.trim() || null,
        openingQty: c.openingQty ?? 0,
      }))
      .filter((c) => c.name.length > 0);

    if (input.hasColourVariants && colours.length === 0) {
      return { ok: false, error: "Add at least one colour" };
    }

    for (const c of colours) {
      if (!Number.isInteger(c.openingQty) || c.openingQty < 0) {
        return { ok: false, error: "Colour opening qty must be ≥ 0" };
      }
    }

    const openingQty = input.openingQty ?? 0;
    if (!input.hasColourVariants) {
      if (!Number.isInteger(openingQty) || openingQty < 0) {
        return { ok: false, error: "Opening qty must be ≥ 0" };
      }
    }

    const id = uuidv7();
    await db.transaction(async (tx) => {
      await tx.insert(trims).values({
        id,
        name,
        type: input.kind,
        kind: input.kind,
        hasColourVariants: input.hasColourVariants,
        unit: "PIECE",
        quantityOnHand: input.hasColourVariants ? 0 : openingQty,
        quantityReserved: 0,
        reorderPoint,
        costPerUnitMinor,
        active: true,
      });

      if (input.hasColourVariants) {
        for (const c of colours) {
          const cwId = uuidv7();
          await tx.insert(trimColourways).values({
            id: cwId,
            trimId: id,
            colourName: c.name,
            hexApproximation: c.hex,
            active: true,
          });
          const stockId = uuidv7();
          await tx.insert(trimStock).values({
            id: stockId,
            trimId: id,
            trimColourwayId: cwId,
            quantityOnHand: c.openingQty,
            quantityReserved: 0,
            reorderPoint,
          });
          if (c.openingQty > 0) {
            await tx.insert(trimMovements).values({
              id: uuidv7(),
              trimStockId: stockId,
              delta: c.openingQty,
              reason: "RECEIVED",
              note: `Opening stock · ${c.name}`,
              actorId: session.user.id,
            });
          }
        }
      } else {
        const stockId = uuidv7();
        await tx.insert(trimStock).values({
          id: stockId,
          trimId: id,
          trimColourwayId: null,
          quantityOnHand: openingQty,
          quantityReserved: 0,
          reorderPoint,
        });
        if (openingQty > 0) {
          await tx.insert(trimMovements).values({
            id: uuidv7(),
            trimStockId: stockId,
            delta: openingQty,
            reason: "RECEIVED",
            note: "Opening stock",
            actorId: session.user.id,
          });
        }
      }

      await insertAuditLog(tx as never, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "inventory.trim.create",
        entityType: "trim",
        entityId: id,
        before: null,
        after: {
          name,
          kind: input.kind,
          hasColourVariants: input.hasColourVariants,
          colourCount: colours.length,
        },
      });
    });

    revalidatePath("/admin/inventory", "layout");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create failed",
    };
  }
}
