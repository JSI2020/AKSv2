"use server";

import { and, count, eq, inArray, or, sql } from "drizzle-orm";

import {
  colourways,
  db,
  designCosts,
  fabricLots,
  fabricReservations,
  fabrics,
  insertAuditLog,
  purchaseOrderLines,
  stockAdjustments,
  type Database,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { completeUpload } from "@/modules/platform/assets";
import { parseMeasureInput } from "@/modules/ui";
import { parseMetresInput } from "@/modules/ui/metres/format";
import { refreshFabricLotStatus } from "@/modules/inventory/lot-status";
import { ensureFabricColourways } from "@/modules/inventory/ledger-queries";
import { revalidateFabricStockPaths } from "@/modules/inventory/revalidate-fabric-paths";

import type { BlockSaveResult } from "./types";
import { listFabrics, getFabric } from "./fabric-archetype-actions";

export { listFabrics, getFabric };

export async function createFabricSwatchAsset(input: {
  key: string;
  mime: string;
}): Promise<{ ok: true; assetId: string } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("fabric.edit");
    if (!input.key.trim() || !input.mime.startsWith("image/")) {
      return { ok: false, error: "An image upload is required." };
    }

    const asset = await completeUpload({
      key: input.key,
      mime: input.mime,
      uploadedById: session.user.id,
    });
    return { ok: true, assetId: asset.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not attach swatch",
    };
  }
}

function parseRupeesToMinor(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole = "", frac = ""] = trimmed.split(".");
  const paisa = (frac + "00").slice(0, 2);
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(paisa, 10);
}

async function insertFabricLot(input: {
  fabricId: string;
  lotCode: string;
  colourNotes: string | null;
  metersHundredths: number;
  costPerMeterMinor: number;
  actorId: string;
  actorRole: string;
}) {
  const lotId = uuidv7();
  const colourNotes = input.colourNotes?.trim() || "Default";
  await db.transaction(async (tx) => {
    await tx.insert(fabricLots).values({
      id: lotId,
      fabricId: input.fabricId,
      lotCode: input.lotCode,
      colourNotes,
      metersReceived: input.metersHundredths,
      metersOnHand: input.metersHundredths,
      metersReserved: 0,
      costPerMeterMinor: input.costPerMeterMinor,
      receivedAt: new Date(),
      status: "AVAILABLE",
    });
    await refreshFabricLotStatus(tx, lotId);
    await tx.insert(stockAdjustments).values({
      id: uuidv7(),
      fabricLotId: lotId,
      deltaMeters: input.metersHundredths,
      reason: "OTHER",
      note: `Received — lot ${input.lotCode}`,
      actorId: input.actorId,
    });
    await insertAuditLog(tx as unknown as Database, {
      id: uuidv7(),
      actorId: input.actorId,
      actorRole: input.actorRole as "OWNER" | "ADMIN" | "STAFF" | "SYSTEM",
      action: "fabric.record_lot",
      entityType: "fabric_lot",
      entityId: lotId,
      before: null,
      after: {
        fabricId: input.fabricId,
        lotCode: input.lotCode,
        meters: input.metersHundredths,
        colourNotes,
      },
    });
  });
  return lotId;
}

async function insertStartingLot(input: {
  fabricId: string;
  lotCode: string;
  metersHundredths: number;
  costPerMeterMinor: number;
  actorId: string;
  actorRole: string;
}) {
  await insertFabricLot({
    ...input,
    colourNotes: "Default",
  });
}

export async function saveFabric(formData: FormData): Promise<BlockSaveResult> {
  try {
    const session = await requirePermission("fabric.edit");
    const id = String(formData.get("id") ?? "") || uuidv7();
    const isNew = !String(formData.get("id") ?? "");
    if (isNew) await requirePermission("fabric.create");

    const name = String(formData.get("name") ?? "").trim();
    const composition = String(formData.get("composition") ?? "").trim();
    const stretchPercent = Number.parseInt(
      String(formData.get("stretchPercent") ?? "0"),
      10,
    );
    const drapeClass = String(formData.get("drapeClass") ?? "MEDIUM") as
      "LIGHT" | "MEDIUM" | "HEAVY";
    const weightGsmRaw = String(formData.get("weightGsm") ?? "").trim();
    const weightGsm = weightGsmRaw ? Number.parseInt(weightGsmRaw, 10) : null;
    const careInstructions =
      String(formData.get("careInstructions") ?? "").trim() || null;
    const drapeNotes = String(formData.get("drapeNotes") ?? "").trim() || null;
    const active = String(formData.get("active") ?? "true") === "true";
    const swatchAssetId =
      String(formData.get("swatchAssetId") ?? "").trim() || null;

    const widthInches =
      parseMeasureInput(
        String(formData.get("widthInchesDisplay") ?? ""),
        "in",
      ) ?? Number.parseInt(String(formData.get("widthInches") ?? ""), 10);
    const shrinkageAllowance =
      parseMeasureInput(String(formData.get("shrinkageDisplay") ?? ""), "in") ??
      Number.parseInt(String(formData.get("shrinkageAllowance") ?? ""), 10);

    const costFromRupees = parseRupeesToMinor(
      String(formData.get("costRupees") ?? ""),
    );
    const costPerMeterMinor =
      costFromRupees ??
      Number.parseInt(String(formData.get("costPerMeterMinor") ?? ""), 10);

    const reorderFromDisplay = parseMetresInput(
      String(formData.get("reorderMetres") ?? ""),
    );
    const reorderPointMeters =
      reorderFromDisplay ??
      Number.parseInt(String(formData.get("reorderPointMeters") ?? "0"), 10);

    if (
      !name ||
      !composition ||
      !Number.isInteger(widthInches) ||
      !Number.isInteger(stretchPercent) ||
      !Number.isInteger(shrinkageAllowance) ||
      !Number.isInteger(costPerMeterMinor) ||
      !Number.isInteger(reorderPointMeters)
    ) {
      return { ok: false, error: "Invalid input" };
    }

    const values = {
      name,
      composition,
      widthInches,
      stretchPercent,
      shrinkageAllowance,
      costPerMeterMinor,
      drapeClass,
      weightGsm:
        weightGsm !== null && Number.isFinite(weightGsm) ? weightGsm : null,
      careInstructions,
      drapeNotes,
      reorderPointMeters,
      swatchAssetId,
      active,
      updatedAt: new Date(),
    };

    if (isNew) {
      await db.insert(fabrics).values({ id, ...values });

      const startingMetres = parseMetresInput(
        String(formData.get("startingMetres") ?? ""),
      );
      const startingLotCode = String(
        formData.get("startingLotCode") ?? "",
      ).trim();
      if (startingMetres && startingMetres > 0 && startingLotCode) {
        await insertStartingLot({
          fabricId: id,
          lotCode: startingLotCode,
          metersHundredths: startingMetres,
          costPerMeterMinor,
          actorId: session.user.id,
          actorRole: session.user.role,
        });
      }
    } else {
      await db.update(fabrics).set(values).where(eq(fabrics.id, id));
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: isNew ? "fabric.create" : "fabric.update",
      entityType: "fabric",
      entityId: id,
      before: null,
      after: values,
    });

    await ensureFabricColourways(id);

    revalidateFabricStockPaths(id);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}

export async function deleteFabric(
  fabricId: string,
): Promise<BlockSaveResult> {
  try {
    const session = await requirePermission("fabric.delete");

    const [before] = await db
      .select()
      .from(fabrics)
      .where(eq(fabrics.id, fabricId))
      .limit(1);
    if (!before) return { ok: false, error: "Fabric not found" };

    const [designColourwayUse] = await db
      .select({ count: count() })
      .from(colourways)
      .where(
        or(
          eq(colourways.fabricId, fabricId),
          sql`EXISTS (SELECT 1 FROM jsonb_each_text(${colourways.pieceFabrics}) AS t(k, v) WHERE t.v = ${fabricId})`,
        ),
      );
    if ((designColourwayUse?.count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "Designs use this fabric — archive it instead of deleting.",
      };
    }

    const [designCostUse] = await db
      .select({ count: count() })
      .from(designCosts)
      .where(
        or(
          eq(designCosts.fabricId, fabricId),
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${designCosts.pieceCosts}) AS elem WHERE elem->>'fabricId' = ${fabricId})`,
        ),
      );
    if ((designCostUse?.count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "Design costing references this fabric — archive it instead.",
      };
    }

    const [poUse] = await db
      .select({ count: count() })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.fabricId, fabricId));
    if ((poUse?.count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "Purchase orders reference this fabric — archive it instead.",
      };
    }

    const [reservedUse] = await db
      .select({ count: count() })
      .from(fabricReservations)
      .innerJoin(fabricLots, eq(fabricReservations.fabricLotId, fabricLots.id))
      .where(
        and(
          eq(fabricLots.fabricId, fabricId),
          eq(fabricReservations.status, "RESERVED"),
        ),
      );
    if ((reservedUse?.count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "Stock is reserved for open orders — release reservations first.",
      };
    }

    const lotRows = await db
      .select({ id: fabricLots.id })
      .from(fabricLots)
      .where(eq(fabricLots.fabricId, fabricId));
    const lotIds = lotRows.map((row) => row.id);

    await db.transaction(async (tx) => {
      if (lotIds.length > 0) {
        await tx
          .delete(stockAdjustments)
          .where(inArray(stockAdjustments.fabricLotId, lotIds));
        await tx
          .delete(fabricReservations)
          .where(inArray(fabricReservations.fabricLotId, lotIds));
        await tx.delete(fabricLots).where(eq(fabricLots.fabricId, fabricId));
      }
      await tx.delete(fabrics).where(eq(fabrics.id, fabricId));
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "fabric.delete",
      entityType: "fabric",
      entityId: fabricId,
      before,
    });

    revalidateFabricStockPaths(fabricId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed",
    };
  }
}

export async function archiveFabric(
  fabricId: string,
): Promise<BlockSaveResult> {
  try {
    const session = await requirePermission("fabric.edit");
    const [before] = await db
      .select()
      .from(fabrics)
      .where(eq(fabrics.id, fabricId))
      .limit(1);
    if (!before) return { ok: false, error: "Fabric not found" };

    await db
      .update(fabrics)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(fabrics.id, fabricId));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "fabric.archive",
      entityType: "fabric",
      entityId: fabricId,
      before: { active: before.active },
      after: { active: false },
    });

    revalidateFabricStockPaths(fabricId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Archive failed",
    };
  }
}

export async function recordFabricLot(
  formData: FormData,
): Promise<BlockSaveResult> {
  try {
    const session = await requirePermission("fabric.adjust_stock");
    const fabricId = String(formData.get("fabricId") ?? "").trim();
    const lotCode = String(formData.get("lotCode") ?? "").trim();
    const colourNotes =
      String(formData.get("colourNotes") ?? "").trim() || null;
    const meters = parseMetresInput(String(formData.get("metres") ?? ""));
    const costFromRupees = parseRupeesToMinor(
      String(formData.get("costRupees") ?? ""),
    );

    if (!fabricId || !lotCode || meters === null || meters <= 0) {
      return { ok: false, error: "Lot code and metres are required." };
    }

    const [fabric] = await db
      .select({ costPerMeterMinor: fabrics.costPerMeterMinor })
      .from(fabrics)
      .where(eq(fabrics.id, fabricId))
      .limit(1);
    if (!fabric) return { ok: false, error: "Fabric not found" };

    const costPerMeterMinor = costFromRupees ?? fabric.costPerMeterMinor;

    await insertFabricLot({
      fabricId,
      lotCode,
      colourNotes,
      metersHundredths: meters,
      costPerMeterMinor,
      actorId: session.user.id,
      actorRole: session.user.role,
    });

    await ensureFabricColourways(fabricId);

    revalidateFabricStockPaths(fabricId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not record lot",
    };
  }
}
