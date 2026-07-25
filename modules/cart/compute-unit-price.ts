import { and, eq, inArray } from "drizzle-orm";

import {
  colourways,
  customizationOptionValues,
  customizationOptions,
  db,
  designs,
} from "@aks/db";

import type { SizeMode } from "@/modules/catalog/types";

import type { CartCustomizationSelections } from "./types";

export type UnitPriceBreakdown = {
  basePriceMinor: number;
  colourwayDeltaMinor: number;
  customizationDeltaMinor: number;
  madeToMeasureSurchargeMinor: number;
  unitPriceMinor: number;
};

export async function computeCartLineUnitPrice(input: {
  designId: string;
  colourwayId: string;
  sizeMode: SizeMode;
  customizationSelections: CartCustomizationSelections;
}): Promise<UnitPriceBreakdown | null> {
  const [designRow] = await db
    .select({
      basePriceMinor: designs.basePriceMinor,
      madeToMeasureSurchargeMinor: designs.madeToMeasureSurchargeMinor,
      status: designs.status,
    })
    .from(designs)
    .where(eq(designs.id, input.designId))
    .limit(1);

  if (!designRow || designRow.status !== "PUBLISHED") return null;

  const [colourwayRow] = await db
    .select({
      priceDeltaMinor: colourways.priceDeltaMinor,
      active: colourways.active,
      designId: colourways.designId,
    })
    .from(colourways)
    .where(eq(colourways.id, input.colourwayId))
    .limit(1);

  if (
    !colourwayRow ||
    !colourwayRow.active ||
    colourwayRow.designId !== input.designId
  ) {
    return null;
  }

  const options = await db
    .select({
      id: customizationOptions.id,
      key: customizationOptions.key,
      inputType: customizationOptions.inputType,
      required: customizationOptions.required,
    })
    .from(customizationOptions)
    .where(eq(customizationOptions.designId, input.designId));

  const optionIds = options.map((o) => o.id);
  const values =
    optionIds.length > 0
      ? await db
          .select({
            optionId: customizationOptionValues.optionId,
            value: customizationOptionValues.value,
            priceDeltaMinor: customizationOptionValues.priceDeltaMinor,
          })
          .from(customizationOptionValues)
          .where(inArray(customizationOptionValues.optionId, optionIds))
      : [];

  let customizationDeltaMinor = 0;

  for (const option of options) {
    const selected = input.customizationSelections[option.key];

    if (option.inputType === "BOOLEAN") {
      if (selected === true) {
        const trueValue = values.find(
          (v) => v.optionId === option.id && v.value === "true",
        );
        customizationDeltaMinor += trueValue?.priceDeltaMinor ?? 0;
      }
      continue;
    }

    if (selected === undefined || selected === "") {
      if (option.required) return null;
      continue;
    }

    if (typeof selected !== "string") return null;

    const match = values.find(
      (v) => v.optionId === option.id && v.value === selected,
    );
    if (!match) return null;
    customizationDeltaMinor += match.priceDeltaMinor;
  }

  const madeToMeasureSurchargeMinor =
    input.sizeMode === "MADE_TO_MEASURE"
      ? designRow.madeToMeasureSurchargeMinor
      : 0;

  const unitPriceMinor =
    designRow.basePriceMinor +
    colourwayRow.priceDeltaMinor +
    customizationDeltaMinor +
    madeToMeasureSurchargeMinor;

  return {
    basePriceMinor: designRow.basePriceMinor,
    colourwayDeltaMinor: colourwayRow.priceDeltaMinor,
    customizationDeltaMinor,
    madeToMeasureSurchargeMinor,
    unitPriceMinor,
  };
}

export async function validatePublishedDesignColourway(input: {
  designId: string;
  colourwayId: string;
}): Promise<boolean> {
  const rows = await db
    .select({ designId: colourways.designId })
    .from(colourways)
    .innerJoin(designs, eq(colourways.designId, designs.id))
    .where(
      and(
        eq(colourways.id, input.colourwayId),
        eq(colourways.designId, input.designId),
        eq(colourways.active, true),
        eq(designs.status, "PUBLISHED"),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
