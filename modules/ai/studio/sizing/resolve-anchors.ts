import { and, eq, inArray } from "drizzle-orm";

import { archetypeAnchorPoints, db } from "@aks/db";

import {
  categoryKeysForComponents,
  defaultAnchorYBp,
} from "./overlay-math";

export async function resolveAnchorYBpByKey(input: {
  archetypeId: string;
  categoryKeys: readonly string[];
  measurementKeys: readonly string[];
}): Promise<Record<string, number>> {
  const categoryKeys = categoryKeysForComponents(input.categoryKeys);
  const rows =
    categoryKeys.length === 0 || input.measurementKeys.length === 0
      ? []
      : await db
          .select({
            categoryKey: archetypeAnchorPoints.categoryKey,
            measurementKey: archetypeAnchorPoints.measurementKey,
            anchorYBp: archetypeAnchorPoints.anchorYBp,
          })
          .from(archetypeAnchorPoints)
          .where(
            and(
              eq(archetypeAnchorPoints.archetypeId, input.archetypeId),
              inArray(archetypeAnchorPoints.categoryKey, categoryKeys),
              inArray(
                archetypeAnchorPoints.measurementKey,
                input.measurementKeys as string[],
              ),
            ),
          );

  const resolved: Record<string, number> = {};
  for (const key of input.measurementKeys) {
    resolved[key] = defaultAnchorYBp(key);
  }

  for (const row of rows) {
    resolved[row.measurementKey] = row.anchorYBp;
  }

  return resolved;
}
