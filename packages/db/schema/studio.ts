import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { designs } from "./catalog";
import { houseModels } from "./fabrics-archetypes";

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
