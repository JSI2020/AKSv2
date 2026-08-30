import { eq } from "drizzle-orm";
import { uuidv7 } from "@aks/shared";
import type { Database } from "@/packages/db";
import {
  dressGeneratedChart,
  dressSizeGrid,
  dressSizeGridRow,
  dressStyle,
  dressStyleFitWeight,
  dressStylePom,
  dressStyleTemplate,
} from "@/packages/db/schema";
import { bodyGridFromRows, composeChart } from "./compose";
import { resolveSilhouette } from "./silhouette";
import type { HemFullness } from "./style-points";
import type { ComposeStyle, GeneratedRow, InstantiatedStyle } from "./types";
import type { GarmentType, StyleStatus } from "../db/enums";
import { ensureDressSizingSeeded } from "../db/ensure";

export type SilhouetteReconcile = Pick<
  InstantiatedStyle,
  "silhouette" | "hemFullness" | "templateKey"
>;

export async function loadActiveGrid(db: Database) {
  await ensureDressSizingSeeded(db);
  const [active] = await db
    .select()
    .from(dressSizeGrid)
    .where(eq(dressSizeGrid.isActive, true))
    .limit(1);
  if (!active) throw new Error("No active body grid");
  const rows = await db
    .select()
    .from(dressSizeGridRow)
    .where(eq(dressSizeGridRow.gridId, active.id));
  return { grid: active, body: bodyGridFromRows(rows) };
}

export async function loadComposeStyle(
  db: Database,
  styleId: string,
): Promise<ComposeStyle> {
  const [row] = await db
    .select()
    .from(dressStyle)
    .where(eq(dressStyle.id, styleId))
    .limit(1);
  if (!row) throw new Error(`Style not found: ${styleId}`);
  const poms = await db
    .select()
    .from(dressStylePom)
    .where(eq(dressStylePom.styleId, styleId));
  return {
    baseSize: row.baseSize,
    poms: poms.map((pom) => ({
      key: pom.key,
      kind: pom.kind,
      derivedFrom: pom.derivedFrom,
      ease: pom.ease,
      baseValue: pom.baseValue,
      gradeIncrement: pom.gradeIncrement,
    })),
  };
}

async function loadSilhouetteContext(
  db: Database,
  styleId: string,
): Promise<SilhouetteReconcile> {
  const [row] = await db
    .select()
    .from(dressStyle)
    .where(eq(dressStyle.id, styleId))
    .limit(1);
  if (!row) throw new Error(`Style not found: ${styleId}`);

  let templateKey: GarmentType = "kurti";
  if (row.templateId) {
    const [template] = await db
      .select({ key: dressStyleTemplate.key })
      .from(dressStyleTemplate)
      .where(eq(dressStyleTemplate.id, row.templateId))
      .limit(1);
    if (template) templateKey = template.key;
  }

  return {
    templateKey,
    silhouette: resolveSilhouette({
      templateKey,
      fitIntent: row.fitIntent,
    }),
    hemFullness: "regular" satisfies HemFullness,
  };
}

export async function persistGeneratedChart(
  db: Database,
  styleId: string,
  rows: GeneratedRow[],
) {
  await db
    .delete(dressGeneratedChart)
    .where(eq(dressGeneratedChart.styleId, styleId));
  if (rows.length) {
    await db.insert(dressGeneratedChart).values(
      rows.map((row) => ({ styleId, ...row })),
    );
  }
  return rows;
}

export async function saveInstantiatedStyle(
  db: Database,
  instantiated: InstantiatedStyle,
  extras?: {
    templateId?: string | null;
    sourceImageUrl?: string | null;
    recognitionConfidence?: number | null;
    status?: StyleStatus;
  },
): Promise<string> {
  const id = uuidv7();
  await db.insert(dressStyle).values({
    id,
    name: instantiated.name,
    templateId: extras?.templateId ?? null,
    category: instantiated.category,
    baseSize: instantiated.baseSize,
    lengthBand: instantiated.lengthBand,
    fitIntent: instantiated.fitIntent,
    sourceImageUrl: extras?.sourceImageUrl ?? null,
    recognitionConfidence: extras?.recognitionConfidence ?? null,
    status: extras?.status ?? "draft",
  });
  await db.insert(dressStylePom).values(
    instantiated.poms.map((pom) => ({ id: uuidv7(), styleId: id, ...pom })),
  );
  await db.insert(dressStyleFitWeight).values(
    instantiated.fitWeights.map((weight) => ({
      id: uuidv7(),
      styleId: id,
      ...weight,
    })),
  );
  return id;
}

export async function generateChartForStyle(
  db: Database,
  styleId: string,
  reconcileFrom?: SilhouetteReconcile,
) {
  const { body } = await loadActiveGrid(db);
  const composeStyle = await loadComposeStyle(db, styleId);
  const reconcile =
    reconcileFrom ?? (await loadSilhouetteContext(db, styleId));
  return persistGeneratedChart(
    db,
    styleId,
    composeChart(body, composeStyle, reconcile),
  );
}

export async function regenerateAllCharts(db: Database): Promise<number> {
  const styles = await db.select({ id: dressStyle.id }).from(dressStyle);
  for (const row of styles) await generateChartForStyle(db, row.id);
  return styles.length;
}