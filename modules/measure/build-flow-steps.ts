import {
  GARMENT_CATEGORY_SEEDS,
  MEASUREMENT_KEY_DEFS,
  type BodyOrGarment,
  type MeasurementKeyCode,
} from "@aks/shared";

export type MeasureFlowStep = {
  stepIndex: number;
  componentKey: string;
  categoryId: string;
  measurementKey: MeasurementKeyCode;
  label: string;
  helpText: string;
  bodyOrGarment: BodyOrGarment;
  demoVideoAssetId: string | null;
};

export type CategoryMeta = {
  id: string;
  key: string;
  measurementKeys: readonly string[];
};

export type MeasurementKeyMeta = {
  key: string;
  label: string;
  bodyOrGarment: BodyOrGarment;
  helpText: string;
  demoVideoAssetId: string | null;
};

const CATEGORY_KEYS_BY_COMPONENT = new Map(
  GARMENT_CATEGORY_SEEDS.map((c) => [c.key, c.measurementKeys]),
);

const MEASUREMENT_DEF_BY_KEY = new Map(
  MEASUREMENT_KEY_DEFS.map((d) => [d.key, d]),
);

export function flowValueKey(componentKey: string, measurementKey: string): string {
  return `${componentKey}:${measurementKey}`;
}

export function effectiveComponents(
  components: readonly string[],
  primaryCategoryKey: string,
): string[] {
  if (components.length > 0) return [...components];
  return [primaryCategoryKey];
}

export function buildMeasureFlowSteps(input: {
  components: readonly string[];
  primaryCategoryKey: string;
  categories: readonly CategoryMeta[];
  measurementKeys: readonly MeasurementKeyMeta[];
}): MeasureFlowStep[] {
  const componentKeys = effectiveComponents(
    input.components,
    input.primaryCategoryKey,
  );

  const categoryByKey = new Map(input.categories.map((c) => [c.key, c]));
  const keyMeta = new Map(input.measurementKeys.map((k) => [k.key, k]));

  const steps: MeasureFlowStep[] = [];
  const seenBodyKeys = new Set<string>();
  let stepIndex = 0;

  for (const componentKey of componentKeys) {
    const category =
      categoryByKey.get(componentKey) ??
      categoryByKey.get(input.primaryCategoryKey);
    if (!category) continue;

    const keys =
      CATEGORY_KEYS_BY_COMPONENT.get(componentKey) ??
      category.measurementKeys;

    for (const measurementKey of keys) {
      if (!MEASUREMENT_DEF_BY_KEY.has(measurementKey)) continue;

      const meta = keyMeta.get(measurementKey);
      const def = MEASUREMENT_DEF_BY_KEY.get(measurementKey)!;
      const bodyOrGarment = meta?.bodyOrGarment ?? def.bodyOrGarment;

      if (bodyOrGarment === "BODY") {
        if (seenBodyKeys.has(measurementKey)) continue;
        seenBodyKeys.add(measurementKey);
      }

      steps.push({
        stepIndex,
        componentKey,
        categoryId: category.id,
        measurementKey: measurementKey as MeasurementKeyCode,
        label: meta?.label ?? def.label,
        helpText: meta?.helpText ?? def.helpText,
        bodyOrGarment,
        demoVideoAssetId: meta?.demoVideoAssetId ?? null,
      });
      stepIndex += 1;
    }
  }

  return steps;
}

export function parseFlowValueKey(key: string): {
  componentKey: string;
  measurementKey: string;
} {
  const idx = key.indexOf(":");
  if (idx === -1) {
    return { componentKey: "", measurementKey: key };
  }
  return {
    componentKey: key.slice(0, idx),
    measurementKey: key.slice(idx + 1),
  };
}
