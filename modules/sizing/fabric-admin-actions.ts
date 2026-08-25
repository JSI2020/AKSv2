"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, fabricLots, fabrics, insertAuditLog, type Database } from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { completeUpload } from "@/modules/platform/assets";
import { parseMeasureInput } from "@/modules/ui";
import { parseMetresInput } from "@/modules/ui/metres/format";
import { refreshFabricLotStatus } from "@/modules/inventory/lot-status";

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

async function insertStartingLot(input: {
  fabricId: string;
  lotCode: string;
  metersHundredths: number;
  costPerMeterMinor: number;
  actorId: string;
  actorRole: string;
}) {
  const lotId = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(fabricLots).values({
      id: lotId,
      fabricId: input.fabricId,
      lotCode: input.lotCode,
      metersReceived: input.metersHundredths,
      metersOnHand: input.metersHundredths,
      metersReserved: 0,
      costPerMeterMinor: input.costPerMeterMinor,
      receivedAt: new Date(),
      status: "AVAILABLE",
    });
    await refreshFabricLotStatus(tx, lotId);
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
      },
    });
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

    revalidatePath("/admin/fabrics");
    revalidatePath(`/admin/fabrics/${id}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
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

    revalidatePath("/admin/fabrics");
    revalidatePath(`/admin/fabrics/${fabricId}`);
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
    const lotId = uuidv7();

    await db.transaction(async (tx) => {
      await tx.insert(fabricLots).values({
        id: lotId,
        fabricId,
        lotCode,
        colourNotes,
        metersReceived: meters,
        metersOnHand: meters,
        metersReserved: 0,
        costPerMeterMinor,
        receivedAt: new Date(),
        status: "AVAILABLE",
      });
      await refreshFabricLotStatus(tx, lotId);
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "fabric.record_lot",
        entityType: "fabric_lot",
        entityId: lotId,
        before: null,
        after: { fabricId, lotCode, meters, colourNotes },
      });
    });

    revalidatePath(`/admin/fabrics/${fabricId}`);
    revalidatePath("/admin/fabrics");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not record lot",
    };
  }
}
