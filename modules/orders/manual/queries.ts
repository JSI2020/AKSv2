import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import {
  colourways,
  customizationOptionValues,
  customizationOptions,
  db,
  designs,
  garmentCategories,
  sizeBlocks,
  users,
} from "@aks/db";

import { getPublishedDesigns } from "@/modules/catalog/queries";

import type {
  CustomerSearchResult,
  ManualOrderDesignDetail,
  ManualOrderDesignOption,
} from "./types";

export async function searchCustomers(
  query: string,
): Promise<CustomerSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const pattern = `%${q}%`;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
        or(
          ilike(users.name, pattern),
          ilike(users.email, pattern),
          ilike(users.phone, pattern),
        ),
      ),
    )
    .orderBy(asc(users.name))
    .limit(20);

  return rows;
}

export async function getManualOrderDesignOptions(): Promise<
  ManualOrderDesignOption[]
> {
  const result = await getPublishedDesigns({
    page: 1,
    pageSize: 200,
    sort: "newest",
  });

  return result.items.map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    basePriceMinor: item.basePriceMinor,
  }));
}

export async function getManualOrderDesignDetail(
  designId: string,
): Promise<ManualOrderDesignDetail | null> {
  const rows = await db
    .select({
      design: designs,
      garmentCategoryKey: garmentCategories.key,
    })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .where(and(eq(designs.id, designId), eq(designs.status, "PUBLISHED")))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [cwRows, opts] = await Promise.all([
    db
      .select({
        id: colourways.id,
        name: colourways.name,
        priceDeltaMinor: colourways.priceDeltaMinor,
        isDefault: colourways.isDefault,
        sortOrder: colourways.sortOrder,
      })
      .from(colourways)
      .where(and(eq(colourways.designId, designId), eq(colourways.active, true)))
      .orderBy(asc(colourways.sortOrder)),
    db
      .select()
      .from(customizationOptions)
      .where(eq(customizationOptions.designId, designId))
      .orderBy(asc(customizationOptions.sortOrder)),
  ]);

  if (cwRows.length === 0) return null;

  const optionIds = opts.map((o) => o.id);
  const values =
    optionIds.length > 0
      ? await db
          .select()
          .from(customizationOptionValues)
          .where(inArray(customizationOptionValues.optionId, optionIds))
          .orderBy(asc(customizationOptionValues.sortOrder))
      : [];

  const valuesByOption = new Map<string, typeof values>();
  for (const value of values) {
    const list = valuesByOption.get(value.optionId) ?? [];
    list.push(value);
    valuesByOption.set(value.optionId, list);
  }

  let sizeLabels: string[] = [];
  if (row.design.sizeBlockId) {
    const [block] = await db
      .select({ sizeLabels: sizeBlocks.sizeLabels })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.id, row.design.sizeBlockId),
          eq(sizeBlocks.active, true),
        ),
      )
      .limit(1);
    sizeLabels = block?.sizeLabels ?? [];
  }

  return {
    id: row.design.id,
    slug: row.design.slug,
    name: row.design.name,
    basePriceMinor: row.design.basePriceMinor,
    madeToMeasureSurchargeMinor: row.design.madeToMeasureSurchargeMinor,
    sizeBlockId: row.design.sizeBlockId,
    components: row.design.components,
    garmentCategoryKey: row.garmentCategoryKey,
    colourways: cwRows.map((cw) => ({
      id: cw.id,
      name: cw.name,
      priceDeltaMinor: cw.priceDeltaMinor,
      isDefault: cw.isDefault,
    })),
    customizationOptions: opts.map((option) => ({
      key: option.key,
      label: option.label,
      inputType: option.inputType,
      required: option.required,
      values: (valuesByOption.get(option.id) ?? []).map((value) => ({
        value: value.value,
        label: value.label,
        priceDeltaMinor: value.priceDeltaMinor,
      })),
    })),
    sizeLabels,
  };
}

export async function getCustomerById(
  userId: string,
): Promise<CustomerSearchResult | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}
