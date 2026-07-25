"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, discounts, insertAuditLog } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { requirePermission } from "@/modules/auth";

import { normalizeDiscountCode } from "./compute";

export type DiscountActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseRequiredInt(raw: string, label: string): number | null {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function parseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTargetIds(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function saveDiscount(formData: FormData): Promise<DiscountActionResult> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const isNew = !id;
    const session = isNew
      ? await requirePermission("discounts.create")
      : await requirePermission("discounts.edit");

    const name = String(formData.get("name") ?? "").trim();
    const codeRaw = String(formData.get("code") ?? "").trim();
    const code = codeRaw ? normalizeDiscountCode(codeRaw) : null;
    const type = String(formData.get("type") ?? "");
    const appliesTo = String(formData.get("appliesTo") ?? "");
    const status = String(formData.get("status") ?? "DRAFT");
    const value = parseRequiredInt(String(formData.get("value") ?? ""), "value");
    const minSpendMinor = parseRequiredInt(
      String(formData.get("minSpendMinor") ?? "0"),
      "minSpendMinor",
    );
    const maxDiscountMinor = parseOptionalInt(
      String(formData.get("maxDiscountMinor") ?? ""),
    );
    const usageLimit = parseOptionalInt(String(formData.get("usageLimit") ?? ""));
    const targetIds = parseTargetIds(String(formData.get("targetIds") ?? ""));

    if (!name) {
      return { ok: false, error: "Name is required." };
    }
    if (value == null || value < 0) {
      return { ok: false, error: "Enter a valid discount value." };
    }
    if (minSpendMinor == null || minSpendMinor < 0) {
      return { ok: false, error: "Enter a valid minimum spend." };
    }
    if (
      type !== "PERCENTAGE" &&
      type !== "FIXED_AMOUNT" &&
      type !== "FREE_SHIPPING"
    ) {
      return { ok: false, error: "Choose a discount type." };
    }
    if (
      appliesTo !== "ORDER" &&
      appliesTo !== "COLLECTION" &&
      appliesTo !== "DESIGN" &&
      appliesTo !== "GARMENT_TYPE"
    ) {
      return { ok: false, error: "Choose what the discount applies to." };
    }
    if (
      status !== "DRAFT" &&
      status !== "ACTIVE" &&
      status !== "PAUSED" &&
      status !== "EXPIRED"
    ) {
      return { ok: false, error: "Choose a status." };
    }
    if (type === "PERCENTAGE" && (value < 1 || value > 100)) {
      return { ok: false, error: "Percentage must be between 1 and 100." };
    }

    const now = new Date();
    const payload = {
      code,
      name,
      type: type as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING",
      value,
      appliesTo: appliesTo as
        | "ORDER"
        | "COLLECTION"
        | "DESIGN"
        | "GARMENT_TYPE",
      targetIds,
      minSpendMinor,
      maxDiscountMinor,
      firstOrderOnly: formData.get("firstOrderOnly") === "on",
      oncePerCustomer: formData.get("oncePerCustomer") === "on",
      usageLimit,
      startsAt: parseDate(String(formData.get("startsAt") ?? "")),
      endsAt: parseDate(String(formData.get("endsAt") ?? "")),
      stackable: formData.get("stackable") === "on",
      status: status as "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED",
      updatedAt: now,
    };

    if (isNew) {
      const newId = uuidv7();
      await db.insert(discounts).values({
        id: newId,
        ...payload,
        usageCount: 0,
        createdAt: now,
      });

      await insertAuditLog(db, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "discount.create",
        entityType: "discount",
        entityId: newId,
        after: payload,
      });

      revalidatePath("/admin/discounts");
      return { ok: true, id: newId };
    }

    const [before] = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, id))
      .limit(1);

    if (!before) {
      return { ok: false, error: "Discount not found." };
    }

    await db.update(discounts).set(payload).where(eq(discounts.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "discount.update",
      entityType: "discount",
      entityId: id,
      before,
      after: payload,
    });

    revalidatePath("/admin/discounts");
    return { ok: true, id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save discount.";
    return { ok: false, error: message };
  }
}

export async function deleteDiscount(id: string): Promise<DiscountActionResult> {
  try {
    const session = await requirePermission("discounts.delete");

    const [before] = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, id))
      .limit(1);

    if (!before) {
      return { ok: false, error: "Discount not found." };
    }

    if (before.usageCount > 0) {
      return {
        ok: false,
        error: "Discounts with redemptions cannot be deleted — pause instead.",
      };
    }

    await db.delete(discounts).where(eq(discounts.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "discount.delete",
      entityType: "discount",
      entityId: id,
      before,
    });

    revalidatePath("/admin/discounts");
    return { ok: true, id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete discount.";
    return { ok: false, error: message };
  }
}
