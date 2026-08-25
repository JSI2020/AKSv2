import { eq } from "drizzle-orm";
import { uuidv7 } from "@aks/shared";
import type { Database } from "@/packages/db";
import {
  dressRecognitionProposal, dressStyle, dressStyleFitWeight, dressStylePom,
  dressStyleTemplate, dressStyleTemplateFitWeight, dressStyleTemplatePom,
} from "@/packages/db/schema";
import { instantiateStyle, type TemplateInput } from "../core/instantiate";
import type { StylePoints } from "../core/style-points";
import { generateChartForStyle, saveInstantiatedStyle } from "../core/generate";
import type { FitIntent, GarmentType, LengthBand, StyleStatus } from "../db/enums";
import { stylePointsFromRawJson } from "./schema";

export async function loadTemplateInput(db: Database, key: GarmentType) {
  const [row] = await db.select().from(dressStyleTemplate).where(eq(dressStyleTemplate.key, key)).limit(1);
  if (!row) throw new Error(`Template not found: ${key}`);
  const poms = await db.select().from(dressStyleTemplatePom).where(eq(dressStyleTemplatePom.templateId, row.id));
  const fitWeights = await db.select().from(dressStyleTemplateFitWeight).where(eq(dressStyleTemplateFitWeight.templateId, row.id));
  const template: TemplateInput = {
    key: row.key, category: row.category, baseSize: row.baseSize,
    poms: poms.map(({ key: pomKey, kind, derivedFrom, ease, baseValue, gradeIncrement }) => ({
      key: pomKey, kind, derivedFrom, ease, baseValue, gradeIncrement,
    })),
    fitWeights: fitWeights.map(({ dimension, weight }) => ({ dimension, weight })),
  };
  return { templateId: row.id, template };
}

export async function buildStyleChart(db: Database, spec: {
  templateKey: GarmentType; lengthBand: LengthBand; fitIntent: FitIntent; name?: string;
  imageUrl?: string | null; confidence?: number | null; status?: StyleStatus; points?: StylePoints;
}) {
  const { templateId, template } = await loadTemplateInput(db, spec.templateKey);
  const instantiated = instantiateStyle(template, spec);
  const styleId = await saveInstantiatedStyle(db, instantiated, {
    templateId, sourceImageUrl: spec.imageUrl, recognitionConfidence: spec.confidence,
    status: spec.status ?? "published",
  });
  const chart = await generateChartForStyle(db, styleId);
  return { styleId, chartRows: chart.length };
}

export async function rebuildStyleChart(db: Database, styleId: string, spec: {
  templateKey: GarmentType; lengthBand: LengthBand; fitIntent: FitIntent; name?: string;
}) {
  const { templateId, template } = await loadTemplateInput(db, spec.templateKey);
  const value = instantiateStyle(template, spec);
  await db.update(dressStyle).set({
    name: value.name, templateId, category: value.category,
    lengthBand: value.lengthBand, fitIntent: value.fitIntent,
  }).where(eq(dressStyle.id, styleId));
  await db.delete(dressStylePom).where(eq(dressStylePom.styleId, styleId));
  await db.delete(dressStyleFitWeight).where(eq(dressStyleFitWeight.styleId, styleId));
  await db.insert(dressStylePom).values(value.poms.map((pom) => ({ id: uuidv7(), styleId, ...pom })));
  await db.insert(dressStyleFitWeight).values(value.fitWeights.map((weight) => ({ id: uuidv7(), styleId, ...weight })));
  await generateChartForStyle(db, styleId);
}

export async function confirmProposal(db: Database, proposalId: string, overrides?: {
  name?: string; templateKey?: GarmentType; lengthBand?: LengthBand; fitIntent?: FitIntent;
}) {
  const [proposal] = await db.select().from(dressRecognitionProposal).where(eq(dressRecognitionProposal.id, proposalId)).limit(1);
  if (!proposal || proposal.status !== "proposed") throw new Error("Proposal is not available.");
  const result = await buildStyleChart(db, {
    templateKey: overrides?.templateKey ?? proposal.templateKey,
    lengthBand: overrides?.lengthBand ?? proposal.lengthBand,
    fitIntent: overrides?.fitIntent ?? proposal.fitIntent,
    name: overrides?.name,
    imageUrl: proposal.imageUrl,
    confidence: proposal.confidence,
    status: "draft",
    points: stylePointsFromRawJson(proposal.rawJson),
  });
  await db.update(dressRecognitionProposal).set({ status: "confirmed" }).where(eq(dressRecognitionProposal.id, proposalId));
  return result;
}

export async function rejectProposal(db: Database, proposalId: string) {
  await db.update(dressRecognitionProposal).set({ status: "rejected" }).where(eq(dressRecognitionProposal.id, proposalId));
}
