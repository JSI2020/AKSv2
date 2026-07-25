import { DESIGN_TAG_VALUES } from "@aks/shared";

import type { CollectionBriefContext } from "./collection-context";
import { formatDesignBriefName } from "./brief-name";

/** Default garment descriptions per category — vision pre-fill stub. */
export const DEFAULT_GARMENT_DESCRIPTIONS: Record<string, string> = {
  KAMEEZ:
    "Two-piece shalwar kameez with straight trouser, modest neckline and full sleeves.",
  TROUSER: "Straight-cut trouser with elasticated waist band.",
  GOWN: "Floor-length modest gown with full sleeves.",
  SKIRT: "A-line midi skirt with modest silhouette.",
  DUPATTA: "Lightweight dupatta with finished edges.",
};

export type StudioDefaultsSlice = {
  defaultArchetypeId: string | null;
  defaultBaseSizeLabel: string;
  backdropLightingProfile: string;
  activePromptTemplateVersion: number;
};

export type BriefInheritedDefaults = {
  garmentTypeId: string;
  categoryKey: string;
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
};

export type BriefFormOptions = {
  categories: { id: string; key: string; name: string }[];
  fabrics: { id: string; name: string; composition: string }[];
  blocks: { id: string; name: string; categoryId: string; categoryKey: string }[];
  profiles: {
    id: string;
    name: string;
    categoryId: string;
    categoryKey: string;
  }[];
  archetypes: {
    id: string;
    name: string;
    buildDescription: string | null;
    heightCm: number;
    heightInches: number;
  }[];
  colourPresets: { name: string; hex: string | null }[];
  tagOptions: {
    occasion: readonly string[];
    season: readonly string[];
    work: readonly string[];
  };
};

export function mergeBriefInheritedDefaults(input: {
  studio: StudioDefaultsSlice;
  collection: CollectionBriefContext | null;
  options: BriefFormOptions;
  categoryId?: string;
  fabricName?: string;
  colourName?: string;
}): BriefInheritedDefaults {
  const { studio, collection, options } = input;

  const category =
    options.categories.find((c) => c.id === input.categoryId) ??
    options.categories.find(
      (c) => c.key === collection?.defaultCategoryKey?.toUpperCase(),
    ) ??
    options.categories[0];

  const categoryKey = category?.key ?? "KAMEEZ";
  const categoryId = category?.id ?? "";

  const archetypeId =
    collection?.defaultArchetypeId ??
    studio.defaultArchetypeId ??
    options.archetypes[0]?.id ??
    "";

  const block =
    options.blocks.find(
      (b) => b.categoryId === categoryId && b.categoryKey === categoryKey,
    ) ?? options.blocks.find((b) => b.categoryId === categoryId);

  const profile =
    options.profiles.find((p) => p.categoryId === categoryId) ??
    options.profiles[0];

  const occasionTag =
    collection?.occasionTags?.[0] ?? DESIGN_TAG_VALUES.OCCASION[0] ?? "EVERYDAY";
  const seasonTag =
    collection?.seasonTag ?? DESIGN_TAG_VALUES.SEASON[0] ?? "MID_SEASON";
  const workTag =
    collection?.workTags?.[0] ?? DESIGN_TAG_VALUES.WORK[0] ?? "PLAIN";

  const fabricLabel = input.fabricName?.trim() ?? "";
  const colourLabel = input.colourName?.trim() ?? "Ivory";

  return {
    garmentTypeId: categoryId,
    categoryKey,
    archetypeId,
    sizeBlockId: block?.id ?? "",
    fitProfileId: profile?.id ?? "",
    occasionTag,
    seasonTag,
    workTag,
    baseSizeLabel: studio.defaultBaseSizeLabel,
    backdrop: studio.backdropLightingProfile,
    garmentDescription:
      DEFAULT_GARMENT_DESCRIPTIONS[categoryKey] ??
      DEFAULT_GARMENT_DESCRIPTIONS.KAMEEZ!,
    shirtColour: colourLabel,
    shirtFabric: fabricLabel,
    trouserColour: colourLabel,
    trouserFabric: fabricLabel,
    embroideryDescription: "",
  };
}

export function suggestBriefName(
  categoryKey: string,
  seq: number,
  year = new Date().getFullYear(),
): string {
  return formatDesignBriefName(categoryKey, year, seq);
}
