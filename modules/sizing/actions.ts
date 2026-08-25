"use server";

import { asc, eq, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  db,
  designs,
  insertAuditLog,
  garmentCategories,
  measurementKeys,
} from "@aks/db";
import {
  isMeasurementKeyCode,
  uuidv7,
  type MeasurementKeyCode,
} from "@aks/shared";
import { requirePermission } from "@/modules/auth";

export type GarmentCategoryRow = typeof garmentCategories.$inferSelect;
export type MeasurementKeyRow = typeof measurementKeys.$inferSelect;

export async function listGarmentCategories(): Promise<GarmentCategoryRow[]> {
  await requirePermission("settings.view");
  return db
    .select()
    .from(garmentCategories)
    .orderBy(asc(garmentCategories.sortOrder), asc(garmentCategories.key));
}

export async function listMeasurementKeys(): Promise<MeasurementKeyRow[]> {
  await requirePermission("settings.view");
  return db.select().from(measurementKeys).orderBy(asc(measurementKeys.key));
}

export async function getGarmentCategory(
  id: string,
): Promise<GarmentCategoryRow | null> {
  await requirePermission("settings.view");
  const rows = await db
    .select()
    .from(garmentCategories)
    .where(eq(garmentCategories.id, id))
    .limit(1);
  return rows[0] ?? null;
}

function parseKeys(raw: FormDataEntryValue | null): MeasurementKeyCode[] | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const keys: MeasurementKeyCode[] = [];
  for (const item of parsed) {
    if (typeof item !== "string" || !isMeasurementKeyCode(item)) return null;
    if (!keys.includes(item)) keys.push(item);
  }
  return keys;
}

export type CategoryActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateGarmentCategory(
  formData: FormData,
): Promise<CategoryActionResult> {
  try {
    const session = await requirePermission("settings.edit");
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const nameUr = String(formData.get("nameUr") ?? "").trim();
    const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? ""), 10);
    const active = String(formData.get("active") ?? "") === "true";
    const keys = parseKeys(formData.get("measurementKeys"));

    if (!id || !name || !nameUr || !Number.isFinite(sortOrder) || !keys) {
      return { ok: false, error: "Invalid input" };
    }

    const existing = await db
      .select()
      .from(garmentCategories)
      .where(eq(garmentCategories.id, id))
      .limit(1);
    const before = existing[0];
    if (!before) return { ok: false, error: "Category not found" };

    if (before.active && !active) {
      const inUse = await db
        .select({ id: designs.id })
        .from(designs)
        .where(
          or(
            eq(designs.garmentTypeId, id),
            sql`${designs.components}::jsonb ? ${before.key}`,
          ),
        )
        .limit(1);
      if (inUse[0]) {
        return {
          ok: false,
          error:
            "Cannot deactivate — at least one design uses this article type",
        };
      }
    }

    const after = {
      name,
      nameUr,
      sortOrder,
      active,
      measurementKeys: keys,
      updatedAt: new Date(),
    };

    await db
      .update(garmentCategories)
      .set(after)
      .where(eq(garmentCategories.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "sizing.category.update",
      entityType: "garment_category",
      entityId: id,
      before: {
        name: before.name,
        nameUr: before.nameUr,
        sortOrder: before.sortOrder,
        active: before.active,
        measurementKeys: before.measurementKeys,
      },
      after: {
        name,
        nameUr,
        sortOrder,
        active,
        measurementKeys: keys,
      },
    });

    revalidatePath("/admin/settings/sizing/categories");
    revalidatePath(`/admin/settings/sizing/categories/${id}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}

export async function createGarmentCategory(
  formData: FormData,
): Promise<CategoryActionResult> {
  try {
    const session = await requirePermission("settings.edit");
    const key = String(formData.get("key") ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "");
    const name = String(formData.get("name") ?? "").trim();
    const nameUr = String(formData.get("nameUr") ?? "").trim();
    const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "100"), 10);
    const keys = parseKeys(formData.get("measurementKeys"));

    if (!key || !name || !nameUr || !Number.isFinite(sortOrder) || !keys) {
      return { ok: false, error: "Invalid input" };
    }

    const id = uuidv7();
    await db.insert(garmentCategories).values({
      id,
      key,
      name,
      nameUr,
      measurementKeys: keys,
      active: true,
      sortOrder,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "sizing.category.create",
      entityType: "garment_category",
      entityId: id,
      before: null,
      after: { key, name, nameUr, sortOrder, measurementKeys: keys },
    });

    revalidatePath("/admin/settings/sizing/categories");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create failed",
    };
  }
}
