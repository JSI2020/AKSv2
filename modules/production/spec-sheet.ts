import { and, asc, eq, inArray } from "drizzle-orm";

import {
  assets,
  colourways,
  customizationOptionValues,
  customizationOptions,
  db,
  designPromptProfiles,
  designRenders,
  fabricLots,
  fabricReservations,
  fabrics,
  measurementKeys,
  orderItems,
  orders,
  productionJobs,
  type OrderCustomizationSnapshot,
  type OrderCutSpecSnapshot,
} from "@aks/db";
import { MEASUREMENT_KEY_DEFS } from "@aks/shared";

import { createPresignedReadUrl } from "@/modules/platform/assets/r2";
import { formatMeasure } from "@/modules/ui";

export type TailorSpecCutRow = {
  key: string;
  labelEn: string;
  labelUr: string;
  valueHundredths: number;
  displayInches: string;
};

export type TailorSpecCustomizationLine = {
  en: string;
  ur: string;
};

export type TailorSpecSheet = {
  jobId: string;
  orderNumber: string;
  designName: string;
  colourwayName: string;
  colourwayNameUr: string;
  lotCode: string | null;
  fabricName: string;
  metresAllocatedHundredths: number | null;
  metresDisplay: string | null;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  cutRows: TailorSpecCutRow[];
  customizations: TailorSpecCustomizationLine[];
  trims: readonly { name: string; note: string }[];
  embroideryNotes: string | null;
  designRenderUrl: string | null;
  dueAt: Date | null;
};

const MEASUREMENT_LABEL_EN = new Map(
  MEASUREMENT_KEY_DEFS.map((d) => [d.key, d.label]),
);
const MEASUREMENT_LABEL_UR = new Map(
  MEASUREMENT_KEY_DEFS.map((d) => [d.key, d.labelUr]),
);

const CUT_KEY_ORDER = new Map(
  MEASUREMENT_KEY_DEFS.map((d, index) => [d.key, index]),
);

/** Integer hundredths of a metre → display string (e.g. 450 → "4.5 m"). */
export function formatMetres(hundredths: number): string {
  if (!Number.isInteger(hundredths)) {
    throw new TypeError("Metres value must be integer hundredths");
  }
  const negative = hundredths < 0;
  const abs = Math.abs(hundredths);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  let body: string;
  if (frac === 0) {
    body = `${whole}`;
  } else if (frac % 10 === 0) {
    body = `${whole}.${frac / 10}`;
  } else {
    body = `${whole}.${frac.toString().padStart(2, "0")}`;
  }
  return `${negative ? "-" : ""}${body} m`;
}

export function bareMeasurementKey(key: string): string {
  return key.includes(":") ? (key.split(":")[1] ?? key) : key;
}

export function componentPrefix(key: string): string | null {
  if (!key.includes(":")) return null;
  return key.split(":")[0] ?? null;
}

function titleCaseComponent(key: string): string {
  return key.charAt(0) + key.slice(1).toLowerCase();
}

export function measurementLabelEn(key: string): string {
  const bare = bareMeasurementKey(key);
  const component = componentPrefix(key);
  const base =
    MEASUREMENT_LABEL_EN.get(bare) ??
    bare.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return component ? `${titleCaseComponent(component)} — ${base}` : base;
}

export function measurementLabelUr(key: string): string {
  const bare = bareMeasurementKey(key);
  const component = componentPrefix(key);
  const base = MEASUREMENT_LABEL_UR.get(bare) ?? bare;
  return component ? `${titleCaseComponent(component)} — ${base}` : base;
}

export function buildCutSpecRows(
  cutSpec: OrderCutSpecSnapshot,
): TailorSpecCutRow[] {
  if (!cutSpec) return [];

  return Object.entries(cutSpec)
    .sort(([a], [b]) => {
      const ai = CUT_KEY_ORDER.get(bareMeasurementKey(a)) ?? 999;
      const bi = CUT_KEY_ORDER.get(bareMeasurementKey(b)) ?? 999;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    })
    .map(([key, valueHundredths]) => ({
      key,
      labelEn: measurementLabelEn(key),
      labelUr: measurementLabelUr(key),
      valueHundredths,
      displayInches: formatMeasure(valueHundredths, "in"),
    }));
}

export async function buildCustomizationLines(
  designId: string,
  snapshot: OrderCustomizationSnapshot,
): Promise<TailorSpecCustomizationLine[]> {
  const entries = Object.entries(snapshot);
  if (entries.length === 0) return [];

  const options = await db
    .select({
      id: customizationOptions.id,
      key: customizationOptions.key,
      label: customizationOptions.label,
      labelUr: customizationOptions.labelUr,
      inputType: customizationOptions.inputType,
    })
    .from(customizationOptions)
    .where(eq(customizationOptions.designId, designId));

  const optionByKey = new Map(options.map((o) => [o.key, o]));
  const optionIds = options.map((o) => o.id);

  const valueRows =
    optionIds.length > 0
      ? await db
          .select({
            optionId: customizationOptionValues.optionId,
            value: customizationOptionValues.value,
            label: customizationOptionValues.label,
            labelUr: customizationOptionValues.labelUr,
          })
          .from(customizationOptionValues)
          .where(inArray(customizationOptionValues.optionId, optionIds))
      : [];

  const valueByOptionValue = new Map(
    valueRows.map((row) => [`${row.optionId}:${row.value}`, row]),
  );

  const lines: TailorSpecCustomizationLine[] = [];

  for (const [key, raw] of entries) {
    const option = optionByKey.get(key);
    if (!option) {
      lines.push({ en: `${key}: ${String(raw)}`, ur: `${key}: ${String(raw)}` });
      continue;
    }

    if (option.inputType === "BOOLEAN") {
      const enabled = raw === true || raw === "true";
      if (!enabled) continue;
      lines.push({
        en: option.label,
        ur: option.labelUr || option.label,
      });
      continue;
    }

    const picked = valueByOptionValue.get(`${option.id}:${String(raw)}`);
    lines.push({
      en: picked
        ? `${option.label}: ${picked.label}`
        : `${option.label}: ${String(raw)}`,
      ur: picked
        ? `${option.labelUr || option.label}: ${picked.labelUr || picked.label}`
        : `${option.labelUr || option.label}: ${String(raw)}`,
    });
  }

  return lines;
}

async function resolveDesignRenderUrl(
  designId: string,
  colourwayId: string,
  thumbnailUrl: string | null | undefined,
): Promise<string | null> {
  const [render] = await db
    .select({ r2Key: assets.r2Key })
    .from(designRenders)
    .innerJoin(assets, eq(designRenders.assetId, assets.id))
    .where(
      and(
        eq(designRenders.designId, designId),
        eq(designRenders.colourwayId, colourwayId),
        eq(designRenders.angle, "FRONT"),
      ),
    )
    .orderBy(asc(designRenders.sortOrder))
    .limit(1);

  if (render?.r2Key) {
    try {
      return await createPresignedReadUrl(render.r2Key, 3600);
    } catch {
      // fall through to thumbnail
    }
  }

  return thumbnailUrl ?? null;
}

export async function getTailorSpecSheet(
  jobId: string,
): Promise<TailorSpecSheet | null> {
  const [row] = await db
    .select({
      jobId: productionJobs.id,
      dueAt: productionJobs.dueAt,
      orderNumber: orders.orderNumber,
      designId: orderItems.designId,
      colourwayId: orderItems.colourwayId,
      designSnapshot: orderItems.designSnapshot,
      sizeMode: orderItems.sizeMode,
      sizeLabel: orderItems.sizeLabel,
      cutSpecSnapshot: orderItems.cutSpecSnapshot,
      customizationSnapshot: orderItems.customizationSnapshot,
      orderItemId: orderItems.id,
    })
    .from(productionJobs)
    .innerJoin(orderItems, eq(productionJobs.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(productionJobs.id, jobId))
    .limit(1);

  if (!row) return null;

  const [colourway, reservation, profile, customizations, designRenderUrl] =
    await Promise.all([
      db
        .select({
          name: colourways.name,
          nameUr: colourways.nameUr,
        })
        .from(colourways)
        .where(eq(colourways.id, row.colourwayId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          lotCode: fabricLots.lotCode,
          metersReserved: fabricReservations.metersReserved,
          actualMetersConsumed: fabricReservations.actualMetersConsumed,
          fabricName: fabrics.name,
        })
        .from(fabricReservations)
        .innerJoin(
          fabricLots,
          eq(fabricReservations.fabricLotId, fabricLots.id),
        )
        .innerJoin(fabrics, eq(fabricLots.fabricId, fabrics.id))
        .where(eq(fabricReservations.orderItemId, row.orderItemId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          embroideryDescription: designPromptProfiles.embroideryDescription,
        })
        .from(designPromptProfiles)
        .where(eq(designPromptProfiles.designId, row.designId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      buildCustomizationLines(row.designId, row.customizationSnapshot),
      resolveDesignRenderUrl(
        row.designId,
        row.colourwayId,
        row.designSnapshot.thumbnailUrl,
      ),
    ]);

  const metresHundredths =
    reservation?.actualMetersConsumed ?? reservation?.metersReserved ?? null;

  return {
    jobId: row.jobId,
    orderNumber: row.orderNumber,
    designName: row.designSnapshot.name,
    colourwayName: colourway?.name ?? "—",
    colourwayNameUr: colourway?.nameUr || colourway?.name || "—",
    lotCode: reservation?.lotCode ?? null,
    fabricName: reservation?.fabricName ?? "—",
    metresAllocatedHundredths: metresHundredths,
    metresDisplay:
      metresHundredths !== null ? formatMetres(metresHundredths) : null,
    sizeMode: row.sizeMode,
    sizeLabel: row.sizeLabel,
    cutRows: buildCutSpecRows(row.cutSpecSnapshot),
    customizations,
    trims: [],
    embroideryNotes: profile?.embroideryDescription?.trim() || null,
    designRenderUrl,
    dueAt: row.dueAt,
  };
}

/** Load DB measurement key labels when present (overrides catalogue defaults). */
export async function hydrateMeasurementLabelsFromDb(
  rows: TailorSpecCutRow[],
): Promise<TailorSpecCutRow[]> {
  const bareKeys = [...new Set(rows.map((r) => bareMeasurementKey(r.key)))];
  if (bareKeys.length === 0) return rows;

  const dbKeys = await db
    .select({
      key: measurementKeys.key,
      label: measurementKeys.label,
      labelUr: measurementKeys.labelUr,
    })
    .from(measurementKeys)
    .where(inArray(measurementKeys.key, bareKeys));

  const byKey = new Map(dbKeys.map((k) => [k.key, k]));

  return rows.map((row) => {
    const bare = bareMeasurementKey(row.key);
    const component = componentPrefix(row.key);
    const dbLabel = byKey.get(bare);
    if (!dbLabel) return row;

    const labelEn = component
      ? `${titleCaseComponent(component)} — ${dbLabel.label}`
      : dbLabel.label;
    const labelUr = component
      ? `${titleCaseComponent(component)} — ${dbLabel.labelUr}`
      : dbLabel.labelUr;

    return { ...row, labelEn, labelUr };
  });
}

export async function getTailorSpecSheetForPrint(
  jobId: string,
): Promise<TailorSpecSheet | null> {
  const sheet = await getTailorSpecSheet(jobId);
  if (!sheet) return null;
  return {
    ...sheet,
    cutRows: await hydrateMeasurementLabelsFromDb(sheet.cutRows),
  };
}
