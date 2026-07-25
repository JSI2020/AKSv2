"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, fabrics, houseModels, insertAuditLog } from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";

import type { BlockSaveResult } from "./types";

export type FabricRow = typeof fabrics.$inferSelect;
export type HouseModelRow = typeof houseModels.$inferSelect;

export async function listFabrics(): Promise<FabricRow[]> {
  await requirePermission("fabric.view");
  return db.select().from(fabrics).orderBy(asc(fabrics.name));
}

export async function getFabric(id: string): Promise<FabricRow | null> {
  await requirePermission("fabric.view");
  const rows = await db.select().from(fabrics).where(eq(fabrics.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function saveFabric(formData: FormData): Promise<BlockSaveResult> {
  try {
    const session = await requirePermission("fabric.edit");
    const id = String(formData.get("id") ?? "") || uuidv7();
    const isNew = !String(formData.get("id") ?? "");
    if (isNew) await requirePermission("fabric.create");

    const name = String(formData.get("name") ?? "").trim();
    const composition = String(formData.get("composition") ?? "").trim();
    const widthInches = Number.parseInt(String(formData.get("widthInches") ?? ""), 10);
    const stretchPercent = Number.parseInt(
      String(formData.get("stretchPercent") ?? "0"),
      10,
    );
    const shrinkageAllowance = Number.parseInt(
      String(formData.get("shrinkageAllowance") ?? "0"),
      10,
    );
    const costPerMeterMinor = Number.parseInt(
      String(formData.get("costPerMeterMinor") ?? "0"),
      10,
    );
    const drapeClass = String(formData.get("drapeClass") ?? "MEDIUM") as
      | "LIGHT"
      | "MEDIUM"
      | "HEAVY";
    const weightGsm = Number.parseInt(String(formData.get("weightGsm") ?? ""), 10);
    const careInstructions =
      String(formData.get("careInstructions") ?? "").trim() || null;
    const drapeNotes = String(formData.get("drapeNotes") ?? "").trim() || null;
    const active = String(formData.get("active") ?? "true") === "true";

    if (
      !name ||
      !composition ||
      !Number.isInteger(widthInches) ||
      !Number.isInteger(stretchPercent) ||
      !Number.isInteger(shrinkageAllowance) ||
      !Number.isInteger(costPerMeterMinor)
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
      weightGsm: Number.isFinite(weightGsm) ? weightGsm : null,
      careInstructions,
      drapeNotes,
      active,
      updatedAt: new Date(),
    };

    if (isNew) {
      await db.insert(fabrics).values({ id, ...values });
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
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}

export async function listHouseModels(): Promise<HouseModelRow[]> {
  await requirePermission("settings.view");
  return db.select().from(houseModels).orderBy(asc(houseModels.name));
}

export async function getHouseModel(
  id: string,
): Promise<HouseModelRow | null> {
  await requirePermission("settings.view");
  const rows = await db
    .select()
    .from(houseModels)
    .where(eq(houseModels.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveHouseModel(
  formData: FormData,
): Promise<BlockSaveResult> {
  try {
    const session = await requirePermission("settings.edit");
    const id = String(formData.get("id") ?? "") || uuidv7();
    const isNew = !String(formData.get("id") ?? "");

    const isAiGenerated = String(formData.get("isAiGenerated") ?? "") === "true";
    if (!isAiGenerated) {
      return {
        ok: false,
        error:
          "isAiGenerated must be true — real likenesses require AI-derivative releases we do not have",
      };
    }

    const name = String(formData.get("name") ?? "").trim();
    const heightCm = Number.parseInt(String(formData.get("heightCm") ?? ""), 10);
    const heightInches = Number.parseInt(
      String(formData.get("heightInches") ?? ""),
      10,
    );
    const bust = Number.parseInt(String(formData.get("bust") ?? ""), 10);
    const waist = Number.parseInt(String(formData.get("waist") ?? ""), 10);
    const hip = Number.parseInt(String(formData.get("hip") ?? ""), 10);
    const shoulder = Number.parseInt(String(formData.get("shoulder") ?? ""), 10);
    const wearsSizeLabel = String(formData.get("wearsSizeLabel") ?? "").trim();
    const identitySeed = String(formData.get("identitySeed") ?? "").trim();
    const buildDescription =
      String(formData.get("buildDescription") ?? "").trim() || null;
    const isDefault = String(formData.get("isDefault") ?? "") === "true";
    const active = String(formData.get("active") ?? "true") === "true";

    if (
      !name ||
      !wearsSizeLabel ||
      !identitySeed ||
      ![heightCm, heightInches, bust, waist, hip, shoulder].every((n) =>
        Number.isInteger(n),
      )
    ) {
      return { ok: false, error: "Invalid input" };
    }

    if (isDefault) {
      await db.update(houseModels).set({ isDefault: false });
    }

    const values = {
      name,
      heightCm,
      heightInches,
      bust,
      waist,
      hip,
      shoulder,
      wearsSizeLabel,
      identitySeed,
      buildDescription,
      isDefault,
      active,
      isAiGenerated: true as const,
      referenceAssetIds: [] as string[],
      updatedAt: new Date(),
    };

    if (isNew) {
      await db.insert(houseModels).values({ id, ...values });
    } else {
      await db.update(houseModels).set(values).where(eq(houseModels.id, id));
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: isNew ? "sizing.archetype.create" : "sizing.archetype.update",
      entityType: "house_model",
      entityId: id,
      before: null,
      after: values,
    });

    revalidatePath("/admin/settings/sizing/archetypes");
    revalidatePath(`/admin/settings/sizing/archetypes/${id}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}
