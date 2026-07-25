"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  colourways,
  db,
  designPromptProfiles,
  designTags,
  designs,
  fabrics,
  fitProfiles,
  garmentCategories,
  houseModels,
  insertAuditLog,
  sizeBlocks,
  STUDIO_SETTINGS_SINGLETON_ID,
  studioSettings,
} from "@aks/db";
import { DESIGN_TAG_VALUES } from "@aks/shared";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { transitionDesignStatus } from "@/modules/designs/studio-pipeline";

import { ensureStudioSettingsRow } from "./defaults";
import {
  mergeBriefInheritedDefaults,
  type BriefFormOptions,
  type BriefInheritedDefaults,
  type StudioDefaultsSlice,
} from "./brief-defaults";
import { formatDesignBriefName, nextDesignBriefSeq } from "./brief-name";
import { resolveCollectionBriefContext } from "./collection-context";

export type DesignBriefFormData = {
  studio: StudioDefaultsSlice;
  collection: ReturnType<typeof resolveCollectionBriefContext>;
  options: BriefFormOptions;
  inherited: BriefInheritedDefaults;
  suggestedName: string;
  duplicateSources: {
    id: string;
    name: string;
    categoryKey: string;
  }[];
  templateVersion: number;
};

export type DesignBriefSavePayload = {
  name: string;
  description: string;
  notes: string;
  garmentTypeId: string;
  archetypeId: string;
  sizeBlockId: string;
  fitProfileId: string;
  occasionTag: string;
  seasonTag: string;
  workTag: string;
  baseSizeLabel: string;
  backdrop: string;
  garmentDescription: string;
  shirtColour: string;
  shirtFabric: string;
  trouserColour: string;
  trouserFabric: string;
  embroideryDescription: string;
  fabricId: string;
  colourwayName: string;
  colourwayHex: string | null;
  combinationBrief: string | null;
  templateVersion: number;
};

export type BriefActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function loadFormOptions(
  fabricPaletteIds?: readonly string[],
): Promise<BriefFormOptions> {
  const [categories, fabricRows, blocks, profiles, archetypes, colourPresetRows] =
    await Promise.all([
      db
        .select({
          id: garmentCategories.id,
          key: garmentCategories.key,
          name: garmentCategories.name,
        })
        .from(garmentCategories)
        .where(eq(garmentCategories.active, true))
        .orderBy(asc(garmentCategories.sortOrder)),
      db
        .select({
          id: fabrics.id,
          name: fabrics.name,
          composition: fabrics.composition,
        })
        .from(fabrics)
        .where(eq(fabrics.active, true))
        .orderBy(asc(fabrics.name)),
      db
        .select({
          id: sizeBlocks.id,
          name: sizeBlocks.name,
          categoryId: sizeBlocks.categoryId,
          categoryKey: garmentCategories.key,
        })
        .from(sizeBlocks)
        .innerJoin(
          garmentCategories,
          eq(sizeBlocks.categoryId, garmentCategories.id),
        )
        .where(and(eq(sizeBlocks.active, true), eq(sizeBlocks.isDefault, true)))
        .orderBy(asc(sizeBlocks.name)),
      db
        .select({
          id: fitProfiles.id,
          name: fitProfiles.name,
          categoryId: fitProfiles.categoryId,
          categoryKey: garmentCategories.key,
        })
        .from(fitProfiles)
        .innerJoin(
          garmentCategories,
          eq(fitProfiles.categoryId, garmentCategories.id),
        )
        .where(eq(fitProfiles.active, true))
        .orderBy(asc(fitProfiles.sortOrder)),
      db
        .select({
          id: houseModels.id,
          name: houseModels.name,
          buildDescription: houseModels.buildDescription,
          heightCm: houseModels.heightCm,
          heightInches: houseModels.heightInches,
        })
        .from(houseModels)
        .where(eq(houseModels.active, true))
        .orderBy(asc(houseModels.name)),
      db
        .selectDistinct({
          name: colourways.name,
          hex: colourways.hexApproximation,
        })
        .from(colourways)
        .orderBy(asc(colourways.name))
        .limit(48),
    ]);

  const paletteSet =
    fabricPaletteIds && fabricPaletteIds.length > 0
      ? new Set(fabricPaletteIds)
      : null;

  const filteredFabrics = paletteSet
    ? fabricRows.filter((f) => paletteSet.has(f.id))
    : fabricRows;

  return {
    categories,
    fabrics: filteredFabrics.length > 0 ? filteredFabrics : fabricRows,
    blocks,
    profiles,
    archetypes,
    colourPresets: colourPresetRows.map((r) => ({
      name: r.name,
      hex: r.hex,
    })),
    tagOptions: {
      occasion: DESIGN_TAG_VALUES.OCCASION,
      season: DESIGN_TAG_VALUES.SEASON,
      work: DESIGN_TAG_VALUES.WORK,
    },
  };
}

export async function getDesignBriefFormData(
  collectionSlug?: string | null,
): Promise<DesignBriefFormData> {
  await requirePermission("designs.create");

  const collection = resolveCollectionBriefContext(collectionSlug);

  const [settingsRow] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  const options = await loadFormOptions(collection?.fabricPaletteIds);

  const settings =
    settingsRow ??
    (await ensureStudioSettingsRow(
      options.archetypes.find((a) => a.id)?.id ?? null,
    ));

  const studio: StudioDefaultsSlice = {
    defaultArchetypeId: settings.defaultArchetypeId,
    defaultBaseSizeLabel: settings.defaultBaseSizeLabel,
    backdropLightingProfile: settings.backdropLightingProfile,
    activePromptTemplateVersion: settings.activePromptTemplateVersion,
  };

  const inherited = mergeBriefInheritedDefaults({
    studio,
    collection,
    options,
  });

  const existingNames = await db
    .select({ name: designs.name })
    .from(designs)
    .orderBy(desc(designs.createdAt));

  const year = new Date().getFullYear();
  const seq = nextDesignBriefSeq(
    existingNames.map((r) => r.name),
    inherited.categoryKey,
    year,
  );
  const suggestedName = formatDesignBriefName(
    inherited.categoryKey,
    year,
    seq,
  );

  const duplicateSources = await db
    .select({
      id: designs.id,
      name: designs.name,
      categoryKey: garmentCategories.key,
    })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .innerJoin(
      designPromptProfiles,
      eq(designPromptProfiles.designId, designs.id),
    )
    .orderBy(desc(designs.updatedAt))
    .limit(40);

  return {
    studio,
    collection,
    options,
    inherited,
    suggestedName,
    duplicateSources,
    templateVersion: settings.activePromptTemplateVersion,
  };
}

export type DuplicateBriefSource = BriefInheritedDefaults & {
  description: string;
  notes: string;
  fabricId: string;
  colourwayName: string;
};

export async function getDuplicateBriefSource(
  designId: string,
): Promise<DuplicateBriefSource | null> {
  await requirePermission("designs.create");

  const rows = await db
    .select({
      design: designs,
      profile: designPromptProfiles,
      categoryKey: garmentCategories.key,
    })
    .from(designs)
    .innerJoin(
      designPromptProfiles,
      eq(designPromptProfiles.designId, designs.id),
    )
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .where(eq(designs.id, designId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [defaultCw] = await db
    .select({ fabricId: colourways.fabricId, name: colourways.name })
    .from(colourways)
    .where(
      and(eq(colourways.designId, designId), eq(colourways.isDefault, true)),
    )
    .limit(1);

  const tags = await db
    .select({ kind: designTags.kind, value: designTags.value })
    .from(designTags)
    .where(eq(designTags.designId, designId));

  const occasionTag =
    tags.find((t) => t.kind === "OCCASION")?.value ?? "EVERYDAY";
  const seasonTag = tags.find((t) => t.kind === "SEASON")?.value ?? "MID_SEASON";
  const workTag = tags.find((t) => t.kind === "WORK")?.value ?? "PLAIN";

  const fitProfileId =
    Object.values(row.design.fitProfileIds ?? {})[0] ?? "";

  const [settingsRow] = await db
    .select({ defaultArchetypeId: studioSettings.defaultArchetypeId })
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  return {
    garmentTypeId: row.design.garmentTypeId,
    categoryKey: row.categoryKey,
    archetypeId: settingsRow?.defaultArchetypeId ?? "",
    sizeBlockId: row.design.sizeBlockId ?? "",
    fitProfileId,
    occasionTag,
    seasonTag,
    workTag,
    baseSizeLabel: "M",
    backdrop: row.profile.backdrop ?? "",
    garmentDescription: row.profile.garmentDescription,
    shirtColour: row.profile.shirtColour,
    shirtFabric: row.profile.shirtFabric,
    trouserColour: row.profile.trouserColour,
    trouserFabric: row.profile.trouserFabric,
    embroideryDescription: row.profile.embroideryDescription,
    notes: row.profile.extraNotes ?? "",
    description: row.design.description ?? "",
    fabricId: defaultCw?.fabricId ?? "",
    colourwayName: defaultCw?.name ?? row.profile.shirtColour,
  };
}

export async function listBriefFabrics(): Promise<
  BriefFormOptions["fabrics"]
> {
  await requirePermission("designs.create");
  return db
    .select({
      id: fabrics.id,
      name: fabrics.name,
      composition: fabrics.composition,
    })
    .from(fabrics)
    .where(eq(fabrics.active, true))
    .orderBy(asc(fabrics.name));
}

export async function listBriefArchetypes(): Promise<
  BriefFormOptions["archetypes"]
> {
  await requirePermission("designs.create");
  return db
    .select({
      id: houseModels.id,
      name: houseModels.name,
      buildDescription: houseModels.buildDescription,
      heightCm: houseModels.heightCm,
      heightInches: houseModels.heightInches,
    })
    .from(houseModels)
    .where(eq(houseModels.active, true))
    .orderBy(asc(houseModels.name));
}

export async function listBriefFitProfiles(): Promise<
  BriefFormOptions["profiles"]
> {
  await requirePermission("designs.create");
  return db
    .select({
      id: fitProfiles.id,
      name: fitProfiles.name,
      categoryId: fitProfiles.categoryId,
      categoryKey: garmentCategories.key,
    })
    .from(fitProfiles)
    .innerJoin(
      garmentCategories,
      eq(fitProfiles.categoryId, garmentCategories.id),
    )
    .where(eq(fitProfiles.active, true))
    .orderBy(asc(fitProfiles.sortOrder));
}

export async function saveDesignBrief(
  payload: DesignBriefSavePayload,
): Promise<BriefActionResult> {
  try {
    const session = await requirePermission("designs.create");

    const name = payload.name.trim();
    const garmentTypeId = payload.garmentTypeId.trim();
    const fabricId = payload.fabricId.trim();
    const colourwayName = payload.colourwayName.trim();

    if (!name || !garmentTypeId || !fabricId || !colourwayName) {
      return { ok: false, error: "Name, category, fabric and colour are required" };
    }

    const [fabric] = await db
      .select({ id: fabrics.id, name: fabrics.name })
      .from(fabrics)
      .where(eq(fabrics.id, fabricId))
      .limit(1);
    if (!fabric) return { ok: false, error: "Fabric not found" };

    const [category] = await db
      .select({ id: garmentCategories.id })
      .from(garmentCategories)
      .where(eq(garmentCategories.id, garmentTypeId))
      .limit(1);
    if (!category) return { ok: false, error: "Category not found" };

    const designId = uuidv7();
    const slug = slugify(name);
    const colourwayId = uuidv7();

    await db.transaction(async (tx) => {
      await tx.insert(designs).values({
        id: designId,
        slug,
        name,
        nameUr: "",
        description: payload.description.trim() || null,
        garmentTypeId,
        components: [],
        status: "DRAFT",
        basePriceMinor: 0,
        madeToMeasureSurchargeMinor: 0,
        fabricConsumptionMeters: 0,
      });

      await tx.insert(designPromptProfiles).values({
        designId,
        garmentDescription: payload.garmentDescription.trim(),
        shirtColour: payload.shirtColour.trim(),
        shirtFabric: payload.shirtFabric.trim() || fabric.name,
        trouserColour: payload.trouserColour.trim(),
        trouserFabric: payload.trouserFabric.trim() || fabric.name,
        embroideryDescription: payload.embroideryDescription.trim(),
        backdrop: payload.backdrop.trim() || null,
        extraNotes: payload.notes.trim() || null,
        templateVersion: payload.templateVersion,
        origin: "SKETCH_LED",
        combinationBrief: payload.combinationBrief?.trim() || null,
      });

      await tx.insert(colourways).values({
        id: colourwayId,
        designId,
        name: colourwayName,
        nameUr: "",
        slug: slugify(colourwayName),
        fabricId,
        hexApproximation: payload.colourwayHex?.trim() || null,
        priceDeltaMinor: 0,
        isDefault: true,
        sortOrder: 0,
        active: true,
      });

      await transitionDesignStatus({
        designId,
        from: "DRAFT",
        to: "BRIEF_COMPLETE",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: "Design brief saved",
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.brief.create",
      entityType: "design",
      entityId: designId,
      before: null,
      after: { name, slug, garmentTypeId, fabricId, colourwayName },
    });

    revalidatePath("/admin/designs");
    revalidatePath("/admin/studio/new");
    revalidatePath(`/admin/studio/${designId}`);
    revalidatePath(`/admin/studio/${designId}/inputs`);
    return { ok: true, id: designId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}
