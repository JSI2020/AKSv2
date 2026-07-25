import { and, asc, desc, eq } from "drizzle-orm";

import {
  customSizeLimits,
  db,
  designs,
  garmentCategories,
  measurementFlowSessions,
  measurementFlowValues,
  measurementKeys,
} from "@aks/db";

import {
  buildMeasureFlowSteps,
  flowValueKey,
  type MeasureFlowStep,
} from "./build-flow-steps";

export type CustomLimitRow = {
  categoryId: string;
  measurementKey: string;
  minValue: number;
  maxValue: number;
  step: number;
  crossFieldRules: import("@aks/shared").CrossFieldRule[];
};

export type MeasureFlowSessionState = {
  sessionId: string;
  designId: string;
  designSlug: string;
  designName: string;
  currentStepIndex: number;
  acknowledgedAt: Date | null;
  completedAt: Date | null;
  steps: MeasureFlowStep[];
  values: Record<string, number>;
  limitsByCategoryKey: Record<string, Record<string, CustomLimitRow>>;
};

export async function loadMeasureFlowSession(input: {
  designSlug: string;
  userId: string | null;
  anonToken: string | null;
}): Promise<MeasureFlowSessionState | null> {
  const designRows = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      name: designs.name,
      components: designs.components,
      garmentTypeId: designs.garmentTypeId,
      categoryKey: garmentCategories.key,
    })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .where(and(eq(designs.slug, input.designSlug), eq(designs.status, "PUBLISHED")))
    .limit(1);

  const design = designRows[0];
  if (!design) return null;

  const [categories, keys, limits, existingSessions] = await Promise.all([
    db
      .select({
        id: garmentCategories.id,
        key: garmentCategories.key,
        measurementKeys: garmentCategories.measurementKeys,
      })
      .from(garmentCategories)
      .where(eq(garmentCategories.active, true)),
    db
      .select({
        key: measurementKeys.key,
        label: measurementKeys.label,
        bodyOrGarment: measurementKeys.bodyOrGarment,
        helpText: measurementKeys.helpText,
        demoVideoAssetId: measurementKeys.demoVideoAssetId,
      })
      .from(measurementKeys),
    db
      .select({
        categoryId: customSizeLimits.categoryId,
        categoryKey: garmentCategories.key,
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
      ),
    db
      .select()
      .from(measurementFlowSessions)
      .where(
        and(
          eq(measurementFlowSessions.designId, design.id),
          input.userId
            ? eq(measurementFlowSessions.userId, input.userId)
            : input.anonToken
              ? eq(measurementFlowSessions.anonToken, input.anonToken)
              : eq(measurementFlowSessions.id, "00000000-0000-0000-0000-000000000000"),
        ),
      )
      .orderBy(desc(measurementFlowSessions.updatedAt))
      .limit(1),
  ]);

  const steps = buildMeasureFlowSteps({
    components: design.components ?? [],
    primaryCategoryKey: design.categoryKey,
    categories,
    measurementKeys: keys,
  });

  const limitsByCategoryKey: Record<
    string,
    Record<string, CustomLimitRow>
  > = {};
  for (const row of limits) {
    if (!limitsByCategoryKey[row.categoryKey]) {
      limitsByCategoryKey[row.categoryKey] = {};
    }
    limitsByCategoryKey[row.categoryKey]![row.measurementKey] = {
      categoryId: row.categoryId,
      measurementKey: row.measurementKey,
      minValue: row.minValue,
      maxValue: row.maxValue,
      step: row.step,
      crossFieldRules: row.crossFieldRules ?? [],
    };
  }

  let session = existingSessions[0];
  if (!session) {
    const { uuidv7 } = await import("@aks/shared");
    const id = uuidv7();
    await db.insert(measurementFlowSessions).values({
      id,
      designId: design.id,
      userId: input.userId,
      anonToken: input.userId ? null : input.anonToken,
      currentStepIndex: 0,
    });
    session = {
      id,
      designId: design.id,
      userId: input.userId,
      anonToken: input.userId ? null : input.anonToken,
      currentStepIndex: 0,
      acknowledgedAt: null,
      completedAt: null,
      saveToProfile: false,
      profileLabel: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const valueRows = await db
    .select()
    .from(measurementFlowValues)
    .where(eq(measurementFlowValues.sessionId, session.id))
    .orderBy(asc(measurementFlowValues.updatedAt));

  const values: Record<string, number> = {};
  for (const row of valueRows) {
    values[flowValueKey(row.componentKey, row.measurementKey)] = row.valueInches;
  }

  return {
    sessionId: session.id,
    designId: design.id,
    designSlug: design.slug,
    designName: design.name,
    currentStepIndex: session.currentStepIndex,
    acknowledgedAt: session.acknowledgedAt,
    completedAt: session.completedAt,
    steps,
    values,
    limitsByCategoryKey,
  };
}

export function resolveLimitForStep(
  step: MeasureFlowStep,
  limitsByCategoryKey: Record<string, Record<string, CustomLimitRow>>,
): CustomLimitRow | null {
  return (
    limitsByCategoryKey[step.componentKey]?.[step.measurementKey] ?? null
  );
}
