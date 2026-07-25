"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  db,
  fitProfiles,
  garmentCategories,
  insertAuditLog,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";

import type { BlockSaveResult } from "./types";

export type FitProfileRow = {
  id: string;
  name: string;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  easeByMeasurement: Record<string, number>;
  clingFactorBps: number;
  isDefault: boolean;
  notes: string | null;
  sortOrder: number;
  active: boolean;
};

export async function listFitProfiles(): Promise<FitProfileRow[]> {
  await requirePermission("settings.view");
  const rows = await db
    .select({
      id: fitProfiles.id,
      name: fitProfiles.name,
      categoryId: fitProfiles.categoryId,
      categoryKey: garmentCategories.key,
      categoryName: garmentCategories.name,
      easeByMeasurement: fitProfiles.easeByMeasurement,
      clingFactorBps: fitProfiles.clingFactorBps,
      isDefault: fitProfiles.isDefault,
      notes: fitProfiles.notes,
      sortOrder: fitProfiles.sortOrder,
      active: fitProfiles.active,
    })
    .from(fitProfiles)
    .innerJoin(
      garmentCategories,
      eq(fitProfiles.categoryId, garmentCategories.id),
    )
    .orderBy(asc(garmentCategories.sortOrder), asc(fitProfiles.sortOrder));

  return rows.map((r) => ({
    ...r,
    easeByMeasurement: r.easeByMeasurement ?? {},
  }));
}

export async function getFitProfile(
  id: string,
): Promise<FitProfileRow | null> {
  await requirePermission("settings.view");
  const rows = await db
    .select({
      id: fitProfiles.id,
      name: fitProfiles.name,
      categoryId: fitProfiles.categoryId,
      categoryKey: garmentCategories.key,
      categoryName: garmentCategories.name,
      easeByMeasurement: fitProfiles.easeByMeasurement,
      clingFactorBps: fitProfiles.clingFactorBps,
      isDefault: fitProfiles.isDefault,
      notes: fitProfiles.notes,
      sortOrder: fitProfiles.sortOrder,
      active: fitProfiles.active,
    })
    .from(fitProfiles)
    .innerJoin(
      garmentCategories,
      eq(fitProfiles.categoryId, garmentCategories.id),
    )
    .where(eq(fitProfiles.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...row, easeByMeasurement: row.easeByMeasurement ?? {} };
}

function parseEase(raw: FormDataEntryValue | null): Record<string, number> | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isInteger(v)) return null;
      out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

export async function updateFitProfile(
  formData: FormData,
): Promise<BlockSaveResult> {
  try {
    const session = await requirePermission("settings.edit");
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const clingFactorBps = Number.parseInt(
      String(formData.get("clingFactorBps") ?? ""),
      10,
    );
    const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? ""), 10);
    const active = String(formData.get("active") ?? "") === "true";
    const isDefault = String(formData.get("isDefault") ?? "") === "true";
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const ease = parseEase(formData.get("easeByMeasurement"));

    if (
      !id ||
      !name ||
      !ease ||
      !Number.isFinite(clingFactorBps) ||
      clingFactorBps < 0 ||
      clingFactorBps > 100 ||
      !Number.isFinite(sortOrder)
    ) {
      return { ok: false, error: "Invalid input" };
    }

    const existing = await db
      .select()
      .from(fitProfiles)
      .where(eq(fitProfiles.id, id))
      .limit(1);
    const before = existing[0];
    if (!before) return { ok: false, error: "Not found" };

    if (isDefault) {
      await db
        .update(fitProfiles)
        .set({ isDefault: false })
        .where(
          and(
            eq(fitProfiles.categoryId, before.categoryId),
            eq(fitProfiles.isDefault, true),
          ),
        );
    }

    await db
      .update(fitProfiles)
      .set({
        name,
        easeByMeasurement: ease,
        clingFactorBps,
        sortOrder,
        active,
        isDefault,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(fitProfiles.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "sizing.fit_profile.update",
      entityType: "fit_profile",
      entityId: id,
      before: {
        name: before.name,
        easeByMeasurement: before.easeByMeasurement,
        clingFactorBps: before.clingFactorBps,
      },
      after: { name, easeByMeasurement: ease, clingFactorBps },
    });

    revalidatePath("/admin/settings/sizing/fit-profiles");
    revalidatePath(`/admin/settings/sizing/fit-profiles/${id}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}

export async function createFitProfile(
  formData: FormData,
): Promise<BlockSaveResult> {
  try {
    const session = await requirePermission("settings.edit");
    const name = String(formData.get("name") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "");
    const clingFactorBps = Number.parseInt(
      String(formData.get("clingFactorBps") ?? "0"),
      10,
    );
    const sortOrder = Number.parseInt(
      String(formData.get("sortOrder") ?? "100"),
      10,
    );
    const ease = parseEase(formData.get("easeByMeasurement"));

    if (!name || !categoryId || !ease || !Number.isFinite(clingFactorBps)) {
      return { ok: false, error: "Invalid input" };
    }

    const id = uuidv7();
    await db.insert(fitProfiles).values({
      id,
      name,
      categoryId,
      easeByMeasurement: ease,
      clingFactorBps,
      isDefault: false,
      sortOrder,
      active: true,
      notes: null,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "sizing.fit_profile.create",
      entityType: "fit_profile",
      entityId: id,
      before: null,
      after: { name, categoryId, easeByMeasurement: ease, clingFactorBps },
    });

    revalidatePath("/admin/settings/sizing/fit-profiles");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create failed",
    };
  }
}
