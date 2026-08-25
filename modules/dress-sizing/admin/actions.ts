"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uuidv7 } from "@aks/shared";
import { db } from "@/packages/db/client";
import { insertAuditLog } from "@/packages/db/audit";
import {
  dressGeneratedChart,
  dressSizeGridRow,
  dressStyle,
  dressStyleFitWeight,
  dressStylePom,
  dressStyleTemplateFitWeight,
  dressStyleTemplatePom,
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
} from "@/packages/db/schema";
import { requirePermission } from "@/modules/auth";
import { inchesToHundredths } from "../core/units";
import { recommendSize } from "../core/recommend";
import { generateChartForStyle, loadActiveGrid, regenerateAllCharts } from "../core/generate";
import { POM_KEYS, STANDARD_SIZES } from "../db/enums";
import type {
  FitIntent,
  FitOutcome,
  FitReason,
  GarmentType,
  LengthBand,
  PomKey,
  StandardSize,
} from "../db/enums";
import { seedBodyGrid } from "../db/seed-grid";
import { seedStyleTemplates } from "../db/seed-templates";
import { recordFitEvent } from "../db/queries";
import { buildStyleChart, confirmProposal, rebuildStyleChart, rejectProposal } from "../recognition/review";
import { recognizeGarment } from "../recognition/recognize";
import { createRecognitionAdapter, recognitionConfigured } from "../recognition/pipeline";
import { uploadVisionFile } from "../providers/fal";

const ROOT = "/admin/settings/sizing/chart";

function refresh(styleId?: string) {
  revalidatePath(ROOT);
  revalidatePath(`${ROOT}/styles`);
  if (styleId) {
    revalidatePath(`${ROOT}/${styleId}`);
    revalidatePath(`${ROOT}/styles/${styleId}`);
  }
}

async function audit(
  session: Awaited<ReturnType<typeof requirePermission>>,
  action: string,
  entityType: string,
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: session.user.id,
    actorRole: session.user.role,
    action,
    entityType,
    entityId,
    before,
    after,
  });
}

async function ensureSeeds() {
  await seedBodyGrid(db);
  await seedStyleTemplates(db);
}

async function saveUpload(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const dir = path.join(process.cwd(), "public", "uploads", "dress-sizing");
  await mkdir(dir, { recursive: true });
  const filename = `${uuidv7()}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/dress-sizing/${filename}`;
}

export async function createChartFromPhoto(formData: FormData): Promise<{ styleId: string }> {
  const session = await requirePermission("settings.edit");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0 || !file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }
  await ensureSeeds();
  const localUrl = await saveUpload(file);
  let templateKey: GarmentType = "kurti";
  let lengthBand: LengthBand = "knee";
  let fitIntent: FitIntent = "semi_fitted";
  let confidence: number | null = null;
  let points: import("../core/style-points").StylePoints | undefined;
  if (recognitionConfigured()) {
    const visionUrl = await uploadVisionFile(file).catch(() => localUrl);
    const proposal = await recognizeGarment(db, visionUrl, createRecognitionAdapter());
    ({ templateKey, lengthBand, fitIntent, confidence, points } = proposal);
  }
  const built = await buildStyleChart(db, {
    templateKey,
    lengthBand,
    fitIntent,
    name: "Design",
    imageUrl: localUrl,
    confidence,
    points,
  });
  await audit(session, "dress_sizing.style.create", "dress_style", built.styleId, null, {
    templateKey,
    lengthBand,
    fitIntent,
  });
  refresh(built.styleId);
  return { styleId: built.styleId };
}

export async function updateChartStyle(styleId: string, spec: {
  templateKey: GarmentType; lengthBand: LengthBand; fitIntent: FitIntent; name?: string;
}) {
  const session = await requirePermission("settings.edit");
  const [before] = await db.select().from(dressStyle).where(eq(dressStyle.id, styleId)).limit(1);
  await rebuildStyleChart(db, styleId, spec);
  await audit(session, "dress_sizing.style.update", "dress_style", styleId, before ?? null, spec);
  refresh(styleId);
}

export async function regradeFromBaseSize(
  styleId: string,
  baseHundredths: Partial<Record<PomKey, number>>,
) {
  const session = await requirePermission("settings.edit");
  const [style] = await db.select().from(dressStyle).where(eq(dressStyle.id, styleId)).limit(1);
  if (!style) throw new Error("Style not found");
  const { body } = await loadActiveGrid(db);
  const poms = await db.select().from(dressStylePom).where(eq(dressStylePom.styleId, styleId));
  for (const pom of poms) {
    const value = baseHundredths[pom.key];
    if (!Number.isInteger(value) || value! <= 0 || value! > 100000) continue;
    await db.update(dressStylePom).set(
      pom.kind === "girth" && pom.derivedFrom
        ? { ease: value! - body[style.baseSize][pom.derivedFrom] }
        : { baseValue: value! },
    ).where(eq(dressStylePom.id, pom.id));
  }
  await generateChartForStyle(db, styleId);
  await audit(session, "dress_sizing.chart.regrade", "dress_style", styleId, null, baseHundredths);
  refresh(styleId);
}

export async function updateGeneratedChartCells(
  styleId: string,
  cells: Array<{ size: StandardSize; pomKey: PomKey; valueHundredths: number }>,
) {
  const session = await requirePermission("settings.edit");
  for (const cell of cells) {
    if (!STANDARD_SIZES.includes(cell.size) || !POM_KEYS.includes(cell.pomKey)) continue;
    if (!Number.isInteger(cell.valueHundredths) || cell.valueHundredths <= 0) continue;
    await db.update(dressGeneratedChart).set({ valueHundredths: cell.valueHundredths }).where(and(
      eq(dressGeneratedChart.styleId, styleId),
      eq(dressGeneratedChart.size, cell.size),
      eq(dressGeneratedChart.pomKey, cell.pomKey),
    ));
  }
  await audit(session, "dress_sizing.chart.update", "dress_style", styleId, null, { cells });
  refresh(styleId);
}

export async function recognizeFromUrl(imageUrl: string) {
  await requirePermission("settings.edit");
  if (!recognitionConfigured()) throw new Error("Configure FAL_KEY or DEEPSEEK_API_KEY first.");
  const result = await recognizeGarment(db, imageUrl, createRecognitionAdapter());
  revalidatePath(`${ROOT}/recognition`);
  return result;
}

export async function confirmProposalAction(proposalId: string, overrides: {
  name?: string; templateKey?: GarmentType; lengthBand?: LengthBand; fitIntent?: FitIntent;
}) {
  const session = await requirePermission("settings.edit");
  const result = await confirmProposal(db, proposalId, overrides);
  await audit(session, "dress_sizing.proposal.confirm", "dress_recognition_proposal", proposalId, null, overrides);
  refresh(result.styleId);
  return result;
}

export async function rejectProposalAction(proposalId: string) {
  const session = await requirePermission("settings.edit");
  await rejectProposal(db, proposalId);
  await audit(session, "dress_sizing.proposal.reject", "dress_recognition_proposal", proposalId, null, { status: "rejected" });
  revalidatePath(`${ROOT}/recognition`);
}

export async function saveGridRowsAction(rows: Array<{
  id: string; bustIn: number; waistIn: number; hipIn: number; shoulderIn: number; heightIn: number;
}>) {
  const session = await requirePermission("settings.edit");
  for (const row of rows) {
    await db.update(dressSizeGridRow).set({
      bust: inchesToHundredths(row.bustIn),
      waist: inchesToHundredths(row.waistIn),
      hip: inchesToHundredths(row.hipIn),
      shoulder: inchesToHundredths(row.shoulderIn),
      height: inchesToHundredths(row.heightIn),
    }).where(eq(dressSizeGridRow.id, row.id));
  }
  await regenerateAllCharts(db);
  await audit(session, "dress_sizing.grid.update", "dress_size_grid", "active", null, { rows: rows.length });
  refresh();
}

type PomEdit = { id: string; easeIn: number | null; baseValueIn: number | null; gradeIncrementIn: number };
export async function saveTemplatePomsAction(templateId: string, poms: PomEdit[], weights: Array<{ id: string; weight: number }>) {
  const session = await requirePermission("settings.edit");
  for (const pom of poms) await db.update(dressStyleTemplatePom).set({
    ease: pom.easeIn == null ? null : inchesToHundredths(pom.easeIn),
    baseValue: pom.baseValueIn == null ? null : inchesToHundredths(pom.baseValueIn),
    gradeIncrement: inchesToHundredths(pom.gradeIncrementIn),
  }).where(eq(dressStyleTemplatePom.id, pom.id));
  for (const weight of weights) await db.update(dressStyleTemplateFitWeight).set({ weight: weight.weight }).where(eq(dressStyleTemplateFitWeight.id, weight.id));
  const linked = await db.select({ id: dressStyle.id }).from(dressStyle).where(eq(dressStyle.templateId, templateId));
  for (const row of linked) await generateChartForStyle(db, row.id);
  await audit(session, "dress_sizing.template.update", "dress_style_template", templateId, null, { poms: poms.length });
  refresh();
}

export async function saveStylePomsAction(styleId: string, poms: PomEdit[], weights: Array<{ id: string; weight: number }>) {
  const session = await requirePermission("settings.edit");
  for (const pom of poms) await db.update(dressStylePom).set({
    ease: pom.easeIn == null ? null : inchesToHundredths(pom.easeIn),
    baseValue: pom.baseValueIn == null ? null : inchesToHundredths(pom.baseValueIn),
    gradeIncrement: inchesToHundredths(pom.gradeIncrementIn),
  }).where(eq(dressStylePom.id, pom.id));
  for (const weight of weights) await db.update(dressStyleFitWeight).set({ weight: weight.weight }).where(eq(dressStyleFitWeight.id, weight.id));
  await generateChartForStyle(db, styleId);
  await audit(session, "dress_sizing.style_poms.update", "dress_style", styleId, null, { poms: poms.length });
  refresh(styleId);
}

export async function publishStyleAction(styleId: string) {
  const session = await requirePermission("settings.edit");
  await db.update(dressStyle).set({ status: "published" }).where(eq(dressStyle.id, styleId));
  await audit(session, "dress_sizing.style.publish", "dress_style", styleId, { status: "draft" }, { status: "published" });
  refresh(styleId);
}

export async function recordFitEventAction(input: {
  styleId: string; size: StandardSize; outcome: FitOutcome; reason: FitReason;
}) {
  const session = await requirePermission("settings.edit");
  const row = await recordFitEvent(db, input);
  await audit(session, "dress_sizing.fit_event.create", "dress_fit_event", row.id, null, input);
  revalidatePath(`${ROOT}/fit-events`);
}

export async function recommendSizeAction(input: {
  styleId: string; bustIn: number; waistIn: number; hipIn: number;
}) {
  await requirePermission("settings.view");
  const [style] = await db.select().from(dressStyle).where(eq(dressStyle.id, input.styleId)).limit(1);
  if (!style) throw new Error("Style not found");
  const weights = await db.select().from(dressStyleFitWeight).where(eq(dressStyleFitWeight.styleId, input.styleId));
  const { body } = await loadActiveGrid(db);
  return recommendSize({
    bust: inchesToHundredths(input.bustIn),
    waist: inchesToHundredths(input.waistIn),
    hip: inchesToHundredths(input.hipIn),
  }, body, weights);
}

const POM_TO_MEASUREMENT: Partial<Record<PomKey, string[]>> = {
  chest: ["chest", "bust"], waist: ["waist"], hip: ["hip"], garmentLength: ["length"],
  shoulder: ["shoulder"], sleeveLength: ["sleeve"],
};

export async function applyDressChartToSizeBlockAction(input: { styleId: string; sizeBlockId: string }) {
  const session = await requirePermission("settings.edit");
  const [block] = await db.select().from(sizeBlocks).where(eq(sizeBlocks.id, input.sizeBlockId)).limit(1);
  if (!block) throw new Error("Size block not found");
  const rows = await db.select().from(sizeBlockRows).where(eq(sizeBlockRows.blockId, input.sizeBlockId));
  const chart = await db.select().from(dressGeneratedChart).where(eq(dressGeneratedChart.styleId, input.styleId));
  let applied = 0;
  for (const cell of chart) {
    if (!block.sizeLabels.includes(cell.size)) continue;
    const candidates = POM_TO_MEASUREMENT[cell.pomKey] ?? [];
    const measurementKey = candidates.find((key) => rows.some((row) => row.measurementKey === key));
    if (!measurementKey) continue;
    await db.insert(sizeBlockCells).values({
      blockId: block.id,
      measurementKey,
      sizeLabel: cell.size,
      value: cell.valueHundredths,
      isPinned: true,
      editedById: session.user.id,
      editedAt: new Date(),
    }).onConflictDoUpdate({
      target: [sizeBlockCells.blockId, sizeBlockCells.measurementKey, sizeBlockCells.sizeLabel],
      set: { value: cell.valueHundredths, isPinned: true, editedById: session.user.id, editedAt: new Date() },
    });
    applied++;
  }
  await audit(session, "dress_sizing.chart.apply_to_size_block", "size_block", block.id, null, {
    styleId: input.styleId,
    applied,
  });
  revalidatePath(`/admin/settings/sizing/blocks/${block.id}`);
  refresh(input.styleId);
  return { applied };
}
