import { and, eq, inArray, isNotNull } from "drizzle-orm";

import {
  cartLines,
  colourways,
  db,
  designs,
  measurementFlowSessions,
  measurementFlowValues,
} from "@aks/db";

import { computeCartLineUnitPrice } from "@/modules/cart/compute-unit-price";

export type CartValidationIssue =
  | {
      kind: "UNAVAILABLE";
      lineId: string;
      designName: string;
      message: string;
    }
  | {
      kind: "PRICE_CHANGED";
      lineId: string;
      designName: string;
      previousMinor: number;
      currentMinor: number;
      message: string;
    };

export type ValidatedCartLine = {
  id: string;
  designId: string;
  colourwayId: string;
  designSlug: string;
  designName: string;
  colourwayName: string;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  measurementProfileId: string | null;
  customizationSelections: Record<string, string | boolean>;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  priceBreakdown: {
    basePriceMinor: number;
    colourwayDeltaMinor: number;
    customizationDeltaMinor: number;
    madeToMeasureSurchargeMinor: number;
    unitPriceMinor: number;
  };
};

export type CartValidationResult =
  | { ok: true; lines: ValidatedCartLine[]; subtotalMinor: number }
  | { ok: false; issues: CartValidationIssue[] };

export async function validateCartForCheckout(
  cartId: string,
): Promise<CartValidationResult> {
  const lines = await db
    .select()
    .from(cartLines)
    .where(eq(cartLines.cartId, cartId))
    .orderBy(cartLines.createdAt);

  if (lines.length === 0) {
    return {
      ok: false,
      issues: [
        {
          kind: "UNAVAILABLE",
          lineId: "",
          designName: "",
          message: "Your cart is empty.",
        },
      ],
    };
  }

  const designIds = [...new Set(lines.map((l) => l.designId))];
  const colourwayIds = [...new Set(lines.map((l) => l.colourwayId))];

  const [designRows, colourwayRows] = await Promise.all([
    db
      .select({
        id: designs.id,
        slug: designs.slug,
        name: designs.name,
        status: designs.status,
      })
      .from(designs)
      .where(inArray(designs.id, designIds)),
    db
      .select({
        id: colourways.id,
        name: colourways.name,
        active: colourways.active,
        designId: colourways.designId,
      })
      .from(colourways)
      .where(inArray(colourways.id, colourwayIds)),
  ]);

  const designById = new Map(designRows.map((d) => [d.id, d]));
  const colourwayById = new Map(colourwayRows.map((c) => [c.id, c]));

  const issues: CartValidationIssue[] = [];
  const validated: ValidatedCartLine[] = [];
  let subtotalMinor = 0;

  for (const line of lines) {
    const design = designById.get(line.designId);
    const colourway = colourwayById.get(line.colourwayId);
    const designName = design?.name ?? "This piece";

    if (
      !design ||
      design.status !== "PUBLISHED" ||
      !colourway ||
      !colourway.active ||
      colourway.designId !== line.designId
    ) {
      issues.push({
        kind: "UNAVAILABLE",
        lineId: line.id,
        designName,
        message: `${designName} is no longer available in that configuration.`,
      });
      continue;
    }

    if (
      line.sizeMode === "MADE_TO_MEASURE" &&
      line.measurementProfileId
    ) {
      const [session] = await db
        .select({ completedAt: measurementFlowSessions.completedAt })
        .from(measurementFlowSessions)
        .where(eq(measurementFlowSessions.id, line.measurementProfileId))
        .limit(1);

      if (!session?.completedAt) {
        issues.push({
          kind: "UNAVAILABLE",
          lineId: line.id,
          designName,
          message: `${designName} needs completed measurements before checkout.`,
        });
        continue;
      }
    }

    const price = await computeCartLineUnitPrice({
      designId: line.designId,
      colourwayId: line.colourwayId,
      sizeMode: line.sizeMode,
      customizationSelections: line.customizationSelections ?? {},
    });

    if (!price) {
      issues.push({
        kind: "UNAVAILABLE",
        lineId: line.id,
        designName,
        message: `${designName} is no longer available in that configuration.`,
      });
      continue;
    }

    if (price.unitPriceMinor !== line.unitPriceMinor) {
      issues.push({
        kind: "PRICE_CHANGED",
        lineId: line.id,
        designName,
        previousMinor: line.unitPriceMinor,
        currentMinor: price.unitPriceMinor,
        message: `The price for ${designName} changed since you added it to your cart.`,
      });
    }

    const lineTotalMinor = price.unitPriceMinor * line.quantity;
    subtotalMinor += lineTotalMinor;

    validated.push({
      id: line.id,
      designId: line.designId,
      colourwayId: line.colourwayId,
      designSlug: design.slug,
      designName: design.name,
      colourwayName: colourway.name,
      sizeMode: line.sizeMode,
      sizeLabel: line.sizeLabel,
      measurementProfileId: line.measurementProfileId,
      customizationSelections: line.customizationSelections ?? {},
      quantity: line.quantity,
      unitPriceMinor: price.unitPriceMinor,
      lineTotalMinor,
      priceBreakdown: price,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, lines: validated, subtotalMinor };
}

export async function loadMeasurementSnapshot(
  sessionId: string,
): Promise<{ sessionId: string; values: Record<string, number> } | null> {
  const [session] = await db
    .select({ id: measurementFlowSessions.id })
    .from(measurementFlowSessions)
    .where(
      and(
        eq(measurementFlowSessions.id, sessionId),
        isNotNull(measurementFlowSessions.completedAt),
      ),
    )
    .limit(1);

  if (!session) return null;

  const valueRows = await db
    .select()
    .from(measurementFlowValues)
    .where(eq(measurementFlowValues.sessionId, sessionId));

  const map: Record<string, number> = {};
  for (const row of valueRows) {
    map[`${row.componentKey}:${row.measurementKey}`] = row.valueInches;
  }

  return { sessionId, values: map };
}
