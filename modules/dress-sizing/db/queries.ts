import { count, desc, eq, sql } from "drizzle-orm";
import { uuidv7 } from "@aks/shared";
import type { Database } from "@/packages/db";
import {
  dressFitEvent, dressGeneratedChart, dressRecognitionProposal, dressSizeGrid,
  dressSizeGridRow, dressStyle, dressStyleFitWeight, dressStylePom,
  dressStyleTemplate, dressStyleTemplateFitWeight, dressStyleTemplatePom,
} from "@/packages/db/schema";
import { STANDARD_SIZES } from "./enums";
import type { FitReason, StandardSize } from "./enums";
import type { BodyMeasurements } from "../core/types";

export async function getActiveGridWithRows(db: Database) {
  const [grid] = await db.select().from(dressSizeGrid).where(eq(dressSizeGrid.isActive, true)).limit(1);
  if (!grid) return null;
  const rows = await db.select().from(dressSizeGridRow).where(eq(dressSizeGridRow.gridId, grid.id));
  rows.sort((a, b) => STANDARD_SIZES.indexOf(a.size) - STANDARD_SIZES.indexOf(b.size));
  return { grid, rows };
}
export async function listTemplates(db: Database) {
  const templates = await db.select().from(dressStyleTemplate);
  const poms = await db.select().from(dressStyleTemplatePom);
  const weights = await db.select().from(dressStyleTemplateFitWeight);
  return templates.map((template) => ({
    ...template,
    poms: poms.filter((pom) => pom.templateId === template.id),
    fitWeights: weights.filter((weight) => weight.templateId === template.id),
  }));
}
export async function getTemplateById(db: Database, id: string) {
  const [template] = await db.select().from(dressStyleTemplate).where(eq(dressStyleTemplate.id, id)).limit(1);
  if (!template) return null;
  const poms = await db.select().from(dressStyleTemplatePom).where(eq(dressStyleTemplatePom.templateId, id));
  const fitWeights = await db.select().from(dressStyleTemplateFitWeight).where(eq(dressStyleTemplateFitWeight.templateId, id));
  return { ...template, poms, fitWeights };
}
export const listStyles = (db: Database) => db.select().from(dressStyle).orderBy(desc(dressStyle.name));
export async function getStyleBundle(db: Database, styleId: string) {
  const [style] = await db.select().from(dressStyle).where(eq(dressStyle.id, styleId)).limit(1);
  if (!style) return null;
  const poms = await db.select().from(dressStylePom).where(eq(dressStylePom.styleId, styleId));
  const fitWeights = await db.select().from(dressStyleFitWeight).where(eq(dressStyleFitWeight.styleId, styleId));
  const chart = await db.select().from(dressGeneratedChart).where(eq(dressGeneratedChart.styleId, styleId));
  return { style, poms, fitWeights, chart };
}
export const listProposals = (db: Database) =>
  db.select().from(dressRecognitionProposal).orderBy(desc(dressRecognitionProposal.createdAt));
export async function getProposal(db: Database, id: string) {
  const [proposal] = await db.select().from(dressRecognitionProposal).where(eq(dressRecognitionProposal.id, id)).limit(1);
  return proposal ?? null;
}
export const getChartRows = (db: Database, styleId: string) =>
  db.select().from(dressGeneratedChart).where(eq(dressGeneratedChart.styleId, styleId));
export async function recordFitEvent(db: Database, input: {
  styleId: string; size: StandardSize;
  outcome: "kept" | "returned" | "exchanged"; reason: FitReason;
}) {
  const [row] = await db.insert(dressFitEvent).values({ id: uuidv7(), ...input }).returning();
  if (!row) throw new Error("Failed to record fit event");
  return row;
}
export function fitEventReport(db: Database, styleId?: string) {
  return db.select({
    styleId: dressFitEvent.styleId, styleName: dressStyle.name, size: dressFitEvent.size,
    reason: dressFitEvent.reason, outcome: dressFitEvent.outcome, count: count(),
  }).from(dressFitEvent).innerJoin(dressStyle, eq(dressStyle.id, dressFitEvent.styleId))
    .where(styleId ? eq(dressFitEvent.styleId, styleId) : sql`true`)
    .groupBy(dressFitEvent.styleId, dressStyle.name, dressFitEvent.size, dressFitEvent.reason, dressFitEvent.outcome);
}
export function gridRowsToMeasurements(
  rows: Array<{ size: StandardSize } & BodyMeasurements>,
): Record<StandardSize, BodyMeasurements> {
  const result = {} as Record<StandardSize, BodyMeasurements>;
  for (const size of STANDARD_SIZES) {
    const row = rows.find((candidate) => candidate.size === size);
    if (!row) throw new Error(`Missing grid row ${size}`);
    result[size] = { bust: row.bust, waist: row.waist, hip: row.hip, shoulder: row.shoulder, height: row.height };
  }
  return result;
}
