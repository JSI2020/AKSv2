"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  customerMeasurementProfiles,
  customerMeasurements,
  customSizeLimits,
  db,
  garmentCategories,
  insertAuditLog,
  measurementFlowSessions,
  measurementFlowValues,
} from "@aks/db";
import type { CrossFieldRule } from "@aks/shared";
import { uuidv7 } from "@aks/shared";

import { auth } from "@/auth";
import { validateMeasurementValue } from "@/modules/sizing/validate-measurement";

import { getOrSetAnonToken, readAnonToken } from "./anon-cookie";
import { flowValueKey } from "./build-flow-steps";
import { loadMeasureFlowSession, resolveLimitForStep } from "./queries";

export type SaveMeasurementResult =
  | {
      ok: true;
      snappedValue: number;
      warnings: string[];
      currentStepIndex: number;
    }
  | { ok: false; error: string; hardErrors?: string[]; warnings?: string[] };

export type CompleteFlowResult =
  | { ok: true; profileId?: string }
  | { ok: false; error: string };

async function getSessionContext(designSlug: string) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonToken = userId ? null : await getOrSetAnonToken();
  const state = await loadMeasureFlowSession({
    designSlug,
    userId,
    anonToken,
  });
  return { userId, state };
}

export async function saveMeasurementField(input: {
  designSlug: string;
  stepIndex: number;
  rawValue: number;
  confirmWarnings?: boolean;
}): Promise<SaveMeasurementResult> {
  const { userId, state } = await getSessionContext(input.designSlug);
  if (!state) return { ok: false, error: "Design not found" };
  if (state.completedAt) {
    return { ok: false, error: "This measurement set is already complete." };
  }

  const step = state.steps[input.stepIndex];
  if (!step) return { ok: false, error: "Unknown step" };

  const limit = resolveLimitForStep(step, state.limitsByCategoryKey);

  const validation = validateMeasurementValue({
    rawValue: input.rawValue,
    limit: limit
      ? {
          minValue: limit.minValue,
          maxValue: limit.maxValue,
          step: limit.step,
          crossFieldRules: limit.crossFieldRules,
        }
      : null,
    componentKey: step.componentKey,
    measurementKey: step.measurementKey,
    values: state.values,
  });

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.hardErrors[0] ?? "Invalid measurement",
      hardErrors: validation.hardErrors,
      warnings: validation.warnings,
    };
  }

  if (validation.warnings.length > 0 && !input.confirmWarnings) {
    return {
      ok: false,
      error: validation.warnings[0] ?? "Unusual measurement",
      warnings: validation.warnings,
    };
  }

  const existing = await db
    .select({ id: measurementFlowValues.id })
    .from(measurementFlowValues)
    .where(
      and(
        eq(measurementFlowValues.sessionId, state.sessionId),
        eq(measurementFlowValues.componentKey, step.componentKey),
        eq(measurementFlowValues.measurementKey, step.measurementKey),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(measurementFlowValues)
      .set({
        valueInches: validation.snappedValue,
        updatedAt: new Date(),
      })
      .where(eq(measurementFlowValues.id, existing[0].id));
  } else {
    await db.insert(measurementFlowValues).values({
      id: uuidv7(),
      sessionId: state.sessionId,
      componentKey: step.componentKey,
      measurementKey: step.measurementKey,
      valueInches: validation.snappedValue,
    });
  }

  const nextStepIndex = Math.max(state.currentStepIndex, input.stepIndex + 1);
  await db
    .update(measurementFlowSessions)
    .set({
      currentStepIndex: Math.min(nextStepIndex, state.steps.length),
      userId: userId ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(measurementFlowSessions.id, state.sessionId));

  revalidatePath(`/designs/${input.designSlug}/measure`);
  return {
    ok: true,
    snappedValue: validation.snappedValue,
    warnings: validation.warnings,
    currentStepIndex: nextStepIndex,
  };
}

export async function setMeasureFlowStep(input: {
  designSlug: string;
  stepIndex: number;
}): Promise<{ ok: boolean }> {
  const { state } = await getSessionContext(input.designSlug);
  if (!state) return { ok: false };

  await db
    .update(measurementFlowSessions)
    .set({
      currentStepIndex: Math.max(
        0,
        Math.min(input.stepIndex, state.steps.length),
      ),
      updatedAt: new Date(),
    })
    .where(eq(measurementFlowSessions.id, state.sessionId));

  revalidatePath(`/designs/${input.designSlug}/measure`);
  return { ok: true };
}

export async function completeMeasureFlow(input: {
  designSlug: string;
  acknowledged: boolean;
  saveToProfile?: boolean;
  profileLabel?: string;
}): Promise<CompleteFlowResult> {
  if (!input.acknowledged) {
    return {
      ok: false,
      error: "Please confirm you understand this is made to your specification.",
    };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonToken = userId ? null : await readAnonToken();
  const state = await loadMeasureFlowSession({
    designSlug: input.designSlug,
    userId,
    anonToken,
  });
  if (!state) return { ok: false, error: "Design not found" };

  const missing = state.steps.filter((step) => {
    const key = flowValueKey(step.componentKey, step.measurementKey);
    return state.values[key] === undefined;
  });
  if (missing.length > 0) {
    return { ok: false, error: "A few measurements are still missing." };
  }

  const now = new Date();
  await db
    .update(measurementFlowSessions)
    .set({
      acknowledgedAt: now,
      completedAt: now,
      saveToProfile: Boolean(input.saveToProfile && userId),
      profileLabel: input.profileLabel?.trim() || null,
      updatedAt: now,
    })
    .where(eq(measurementFlowSessions.id, state.sessionId));

  let profileId: string | undefined;
  if (input.saveToProfile && userId) {
    const primaryStep = state.steps[0];
    if (primaryStep) {
      profileId = uuidv7();
      await db.insert(customerMeasurementProfiles).values({
        id: profileId,
        userId,
        label: input.profileLabel?.trim() || "My measurements",
        categoryId: primaryStep.categoryId,
        isDefault: false,
      });

      const byKey = new Map<string, number>();
      for (const step of state.steps) {
        const key = flowValueKey(step.componentKey, step.measurementKey);
        const value = state.values[key];
        if (value === undefined) continue;
        if (!byKey.has(step.measurementKey)) {
          byKey.set(step.measurementKey, value);
        }
      }

      for (const [measurementKey, valueInches] of byKey) {
        await db.insert(customerMeasurements).values({
          id: uuidv7(),
          profileId,
          measurementKey,
          valueInches,
        });
      }
    }
  }

  revalidatePath(`/designs/${input.designSlug}/measure`);
  revalidatePath(`/designs/${input.designSlug}`);
  return { ok: true, profileId };
}

export type CustomSizeLimitAdminRow = {
  id: string;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  measurementKey: string;
  minValue: number;
  maxValue: number;
  step: number;
  crossFieldRules: CrossFieldRule[];
};

export async function listCustomSizeLimitsForAdmin(): Promise<
  CustomSizeLimitAdminRow[]
> {
  const { requirePermission } = await import("@/modules/auth");
  await requirePermission("settings.view");

  const rows = await db
    .select({
      id: customSizeLimits.id,
      categoryId: customSizeLimits.categoryId,
      categoryKey: garmentCategories.key,
      categoryName: garmentCategories.name,
      measurementKey: customSizeLimits.measurementKey,
      minValue: customSizeLimits.minValue,
      maxValue: customSizeLimits.maxValue,
      step: customSizeLimits.step,
      crossFieldRules: customSizeLimits.crossFieldRules,
    })
    .from(customSizeLimits)
    .innerJoin(
      garmentCategories,
      eq(customSizeLimits.categoryId, garmentCategories.id),
    );

  return rows.map((r) => ({
    ...r,
    crossFieldRules: r.crossFieldRules ?? [],
  }));
}

export async function getCustomSizeLimit(
  id: string,
): Promise<CustomSizeLimitAdminRow | null> {
  const { requirePermission } = await import("@/modules/auth");
  await requirePermission("settings.view");

  const rows = await db
    .select({
      id: customSizeLimits.id,
      categoryId: customSizeLimits.categoryId,
      categoryKey: garmentCategories.key,
      categoryName: garmentCategories.name,
      measurementKey: customSizeLimits.measurementKey,
      minValue: customSizeLimits.minValue,
      maxValue: customSizeLimits.maxValue,
      step: customSizeLimits.step,
      crossFieldRules: customSizeLimits.crossFieldRules,
    })
    .from(customSizeLimits)
    .innerJoin(
      garmentCategories,
      eq(customSizeLimits.categoryId, garmentCategories.id),
    )
    .where(eq(customSizeLimits.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { ...row, crossFieldRules: row.crossFieldRules ?? [] };
}

function parseCrossFieldRules(
  raw: FormDataEntryValue | null,
): CrossFieldRule[] | null {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as CrossFieldRule[];
  } catch {
    return null;
  }
}

export async function updateCustomSizeLimit(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { requirePermission } = await import("@/modules/auth");
    const authSession = await requirePermission("settings.edit");

    const id = String(formData.get("id") ?? "");
    const minValue = Number.parseInt(String(formData.get("minValue") ?? ""), 10);
    const maxValue = Number.parseInt(String(formData.get("maxValue") ?? ""), 10);
    const step = Number.parseInt(String(formData.get("step") ?? "25"), 10);
    const rules = parseCrossFieldRules(formData.get("crossFieldRules"));

    if (
      !id ||
      !Number.isInteger(minValue) ||
      !Number.isInteger(maxValue) ||
      !Number.isInteger(step) ||
      minValue > maxValue ||
      step <= 0 ||
      rules === null
    ) {
      return { ok: false, error: "Invalid input" };
    }

    const existing = await db
      .select()
      .from(customSizeLimits)
      .where(eq(customSizeLimits.id, id))
      .limit(1);
    const before = existing[0];
    if (!before) return { ok: false, error: "Not found" };

    await db
      .update(customSizeLimits)
      .set({
        minValue,
        maxValue,
        step,
        crossFieldRules: rules,
        updatedAt: new Date(),
      })
      .where(eq(customSizeLimits.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: authSession.user.id,
      actorRole: authSession.user.role,
      action: "sizing.custom_limit.update",
      entityType: "custom_size_limit",
      entityId: id,
      before: {
        minValue: before.minValue,
        maxValue: before.maxValue,
        step: before.step,
      },
      after: { minValue, maxValue, step },
    });

    revalidatePath("/admin/settings/sizing/custom-limits");
    revalidatePath(`/admin/settings/sizing/custom-limits/${id}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}

export async function createCustomSizeLimit(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { requirePermission } = await import("@/modules/auth");
    const authSession = await requirePermission("settings.edit");

    const categoryId = String(formData.get("categoryId") ?? "");
    const measurementKey = String(formData.get("measurementKey") ?? "").trim();
    const minValue = Number.parseInt(String(formData.get("minValue") ?? ""), 10);
    const maxValue = Number.parseInt(String(formData.get("maxValue") ?? ""), 10);
    const step = Number.parseInt(String(formData.get("step") ?? "25"), 10);
    const rules = parseCrossFieldRules(formData.get("crossFieldRules"));

    if (
      !categoryId ||
      !measurementKey ||
      !Number.isInteger(minValue) ||
      !Number.isInteger(maxValue) ||
      !Number.isInteger(step) ||
      minValue > maxValue ||
      step <= 0 ||
      rules === null
    ) {
      return { ok: false, error: "Invalid input" };
    }

    const id = uuidv7();
    await db.insert(customSizeLimits).values({
      id,
      categoryId,
      measurementKey,
      minValue,
      maxValue,
      step,
      crossFieldRules: rules,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: authSession.user.id,
      actorRole: authSession.user.role,
      action: "sizing.custom_limit.create",
      entityType: "custom_size_limit",
      entityId: id,
      before: null,
      after: { categoryId, measurementKey, minValue, maxValue, step },
    });

    revalidatePath("/admin/settings/sizing/custom-limits");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}
