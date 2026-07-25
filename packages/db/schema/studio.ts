import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { colourways, designs } from "./catalog";
import { houseModels } from "./fabrics-archetypes";
import { assets } from "./platform";
import { users } from "./identity";

export const designInputRoleEnum = pgEnum("design_input_role", [
  "SKETCH_FRONT",
  "SKETCH_BACK",
  "SKETCH_SIDE",
  "SKETCH_DETAIL",
  "TECHNICAL_FLAT",
  "FABRIC_SWATCH",
  "REFERENCE_OWN",
  "REFERENCE_EXTERNAL",
]);

export const promptProfileOriginEnum = pgEnum("prompt_profile_origin", [
  "SKETCH_LED",
  "REFERENCE_LED",
  "FABRIC_LED",
]);

/** fal model id placeholders until Step 36 resolves real ids. */
export type AiJobType = "hero" | "angle" | "colourway" | "draft";

export type DefaultAiModelsMap = Record<AiJobType, string>;

/** Fixed singleton row id — studio_settings holds one row only. */
export const STUDIO_SETTINGS_SINGLETON_ID =
  "01900000-0000-7000-8000-000000000001";

export const studioSettings = pgTable("studio_settings", {
  id: uuid("id").primaryKey(),
  defaultArchetypeId: uuid("default_archetype_id").references(
    () => houseModels.id,
  ),
  defaultBaseSizeLabel: text("default_base_size_label").notNull().default("M"),
  backdropLightingProfile: text("backdrop_lighting_profile").notNull(),
  defaultAiModels: jsonb("default_ai_models")
    .$type<DefaultAiModelsMap>()
    .notNull(),
  defaultLeadTimeDays: integer("default_lead_time_days").notNull().default(21),
  defaultPriceTier: text("default_price_tier"),
  /** Optional PKR paisa hint for new designs — not a live price. */
  basePriceHintMinor: integer("base_price_hint_minor"),
  activePromptTemplateVersion: integer("active_prompt_template_version")
    .notNull()
    .default(1),
  /** USD cap stored as whole cents to avoid floats. */
  monthlySpendCapUsdCents: integer("monthly_spend_cap_usd_cents"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const designGenerationStageEnum = pgEnum("design_generation_stage", [
  "HERO",
  "ANGLE",
  "COLOURWAY",
]);

export const designGenerationStatusEnum = pgEnum("design_generation_status", [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
]);

export const designGenerationDecisionEnum = pgEnum("design_generation_decision", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

/** Append-only ledger — every AI generation attempt is recorded. */
export const designGenerations = pgTable("design_generations", {
  id: uuid("id").primaryKey(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  stage: designGenerationStageEnum("stage").notNull(),
  angle: text("angle"),
  colourwayId: uuid("colourway_id").references(() => colourways.id),
  parentGenerationId: uuid("parent_generation_id"),
  archetypeId: uuid("archetype_id").references(() => houseModels.id),
  sizeBlockSnapshot: jsonb("size_block_snapshot").$type<Record<string, unknown>>(),
  provider: text("provider").notNull().default("fal"),
  modelId: text("model_id").notNull(),
  promptJson: jsonb("prompt_json").$type<Record<string, unknown>>().notNull(),
  negativePrompt: text("negative_prompt"),
  seed: integer("seed"),
  templateVersion: integer("template_version").notNull(),
  inputAssetIds: jsonb("input_asset_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  outputAssetId: uuid("output_asset_id").references(() => assets.id),
  /** Image calibration — modelPixelHeight, detection method, dimensions. */
  outputMeta: jsonb("output_meta").$type<{
    imageWidthPx?: number;
    imageHeightPx?: number;
    modelPixelHeight?: number;
    modelHeightDetection?: "sharp_bbox" | "stored" | "fallback_fraction";
  }>(),
  status: designGenerationStatusEnum("status").notNull().default("PENDING"),
  /** USD stored as micro-dollars (1 USD = 1_000_000) — never floats. */
  costUsdMicros: integer("cost_usd_micros"),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  processingAttempts: integer("processing_attempts").notNull().default(0),
  decision: designGenerationDecisionEnum("decision")
    .notNull()
    .default("PENDING"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const designPromptProfiles = pgTable("design_prompt_profiles", {
  designId: uuid("design_id")
    .primaryKey()
    .references(() => designs.id, { onDelete: "cascade" }),
  garmentDescription: text("garment_description").notNull().default(""),
  shirtColour: text("shirt_colour").notNull().default(""),
  shirtFabric: text("shirt_fabric").notNull().default(""),
  trouserColour: text("trouser_colour").notNull().default(""),
  trouserFabric: text("trouser_fabric").notNull().default(""),
  embroideryDescription: text("embroidery_description").notNull().default(""),
  backdrop: text("backdrop"),
  extraNotes: text("extra_notes"),
  templateVersion: integer("template_version").notNull().default(1),
  origin: promptProfileOriginEnum("origin").notNull().default("SKETCH_LED"),
  combinationBrief: text("combination_brief"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Versioned IP attestation for external reference uploads. */
export const designInputAttestations = pgTable("design_input_attestations", {
  id: uuid("id").primaryKey(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  statement: text("statement").notNull(),
  version: integer("version").notNull(),
  attestedById: uuid("attested_by_id")
    .notNull()
    .references(() => users.id),
  attestedAt: timestamp("attested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const designLockStageEnum = pgEnum("design_lock_stage", [
  "HERO",
  "SIZING",
  "ANGLE",
  "COLOURWAY",
]);

/** One row per locked stage — points at the approved generation. */
export const designLocks = pgTable(
  "design_locks",
  {
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    stage: designLockStageEnum("stage").notNull(),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => designGenerations.id),
    lockedBy: uuid("locked_by")
      .notNull()
      .references(() => users.id),
    lockedAt: timestamp("locked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.designId, t.stage] })],
);

export const designInputs = pgTable("design_inputs", {
  id: uuid("id").primaryKey(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  role: designInputRoleEnum("role").notNull(),
  /** 0–100 hundredths of unit weight (100 = full follow). Never floats. */
  weight: integer("weight").notNull().default(100),
  derivedAssetId: uuid("derived_asset_id").references(() => assets.id),
  attestationId: uuid("attestation_id").references(
    () => designInputAttestations.id,
  ),
  purgeAt: timestamp("purge_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
