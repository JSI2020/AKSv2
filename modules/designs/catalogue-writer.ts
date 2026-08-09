/**
 * Programmatic catalogue write path — mirrors admin create → price → tags →
 * colourway → render → publish (transition + audit_log).
 * Storefront must only ever show designs that pass this path (or admin UI).
 */
import { eq } from "drizzle-orm";

import {
  assets,
  colourways,
  db,
  designRenders,
  designs,
  designTags,
  insertAuditLog,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { transition } from "@/modules/platform/transition";

import { evaluatePublishChecklist } from "./publish-checklist";
import { DESIGN_TRANSITION_ALLOW } from "./transitions";

export type CatalogueActor = {
  id: string;
  role: string;
};

export type CatalogueColourwayInput = {
  name: string;
  slug: string;
  fabricId: string;
  hexApproximation: string;
  priceDeltaMinor?: number;
  isDefault?: boolean;
  sortOrder?: number;
};

export type CreatePublishedCatalogueDesignInput = {
  slug: string;
  name: string;
  nameUr?: string;
  description: string;
  storyCopy: string;
  garmentTypeId: string;
  components: string[];
  sizeBlockId: string;
  fitProfileIds: Record<string, string>;
  basePriceMinor: number;
  madeToMeasureSurchargeMinor: number;
  fabricConsumptionMeters: number;
  leadTimeDaysOverride?: number;
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  tags: { kind: "OCCASION" | "SEASON" | "WORK" | "FREE"; value: string }[];
  colourways: CatalogueColourwayInput[];
  placeholderAssetId: string;
  actor: CatalogueActor;
  auditNote?: string;
};

function slugifyColourway(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Reusable placeholder IMAGE asset so publish checklist can attach a FRONT render. */
export async function ensureCataloguePlaceholderAsset(
  actorId: string,
): Promise<string> {
  const r2Key = "catalogue/placeholder-front.webp";
  const existing = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.r2Key, r2Key))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const id = uuidv7();
  await db.insert(assets).values({
    id,
    r2Key,
    mime: "image/webp",
    width: 1200,
    height: 1600,
    bytes: 1024,
    sha256: "0".repeat(64),
    kind: "IMAGE",
    uploadedById: actorId,
    isAiGenerated: false,
  });
  return id;
}

/**
 * Create DRAFT → attach merchandising → admin publish checklist → PUBLISHED + audit.
 */
export async function createPublishedCatalogueDesign(
  input: CreatePublishedCatalogueDesignInput,
): Promise<{ id: string; slug: string; colourwayId: string }> {
  if (input.colourways.length < 1) {
    throw new Error("At least one colourway is required");
  }

  const designId = uuidv7();
  const colourwayRows = input.colourways.map((cw, index) => ({
    id: uuidv7(),
    designId,
    name: cw.name,
    nameUr: cw.name,
    slug: slugifyColourway(cw.slug || cw.name),
    fabricId: cw.fabricId,
    hexApproximation: cw.hexApproximation,
    priceDeltaMinor: cw.priceDeltaMinor ?? 0,
    isDefault: cw.isDefault ?? index === 0,
    sortOrder: cw.sortOrder ?? index,
    active: true,
  }));

  await db.insert(designs).values({
    id: designId,
    slug: input.slug,
    name: input.name,
    nameUr: input.nameUr ?? input.name,
    description: input.description,
    storyCopy: input.storyCopy,
    status: "DRAFT",
    garmentTypeId: input.garmentTypeId,
    components: input.components,
    sizeBlockId: input.sizeBlockId,
    fitProfileIds: input.fitProfileIds,
    basePriceMinor: input.basePriceMinor,
    madeToMeasureSurchargeMinor: input.madeToMeasureSurchargeMinor,
    fabricConsumptionMeters: input.fabricConsumptionMeters,
    leadTimeDaysOverride: input.leadTimeDaysOverride ?? null,
    featured: Boolean(input.featured),
    publishedAt: null,
    seoTitle: input.seoTitle ?? `${input.name} | AKS`,
    seoDescription: input.seoDescription ?? input.storyCopy.slice(0, 140),
  });

  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "design.create",
    entityType: "design",
    entityId: designId,
    before: null,
    after: {
      name: input.name,
      slug: input.slug,
      garmentTypeId: input.garmentTypeId,
      source: "catalogue_writer",
    },
  });

  await db.insert(designTags).values(
    input.tags.map((t) => ({
      designId,
      kind: t.kind,
      value: t.value,
    })),
  );

  await db.insert(colourways).values(colourwayRows);

  const renderRows = colourwayRows.map((cw, index) => ({
    id: uuidv7(),
    designId,
    colourwayId: cw.id,
    angle: "FRONT" as const,
    archetypeId: null,
    assetId: input.placeholderAssetId,
    isAiGenerated: false,
    altText: `${input.name} in ${cw.name}, front view`,
    sortOrder: index,
  }));
  await db.insert(designRenders).values(renderRows);

  const missing = evaluatePublishChecklist({
    design: {
      basePriceMinor: input.basePriceMinor,
      fabricConsumptionMeters: input.fabricConsumptionMeters,
      sizeBlockId: input.sizeBlockId,
      fitProfileIds: input.fitProfileIds,
    },
    colourways: colourwayRows.map((c) => ({ id: c.id, name: c.name })),
    renders: renderRows.map((r) => ({
      colourwayId: r.colourwayId,
      angle: r.angle,
      altText: r.altText,
    })),
    tags: input.tags,
  });
  if (missing.length) {
    throw new Error(`Publish checklist: ${missing.join("; ")}`);
  }

  await db.transaction(async (tx) => {
    await transition({
      entity: "design",
      id: designId,
      from: "DRAFT",
      to: "PUBLISHED",
      actor: { id: input.actor.id, role: input.actor.role },
      note: input.auditNote ?? "Catalogue publish",
      allowList: DESIGN_TRANSITION_ALLOW,
      tx,
    });
  });

  await db
    .update(designs)
    .set({ publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(designs.id, designId));

  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "design.publish",
    entityType: "design",
    entityId: designId,
    before: { status: "DRAFT" },
    after: { status: "PUBLISHED", source: "catalogue_writer" },
  });

  const defaultCw =
    colourwayRows.find((c) => c.isDefault) ?? colourwayRows[0]!;

  return { id: designId, slug: input.slug, colourwayId: defaultCw.id };
}
