import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { assets } from "./platform";
import { createEntityEventsTable } from "./events";
import { garmentCategories } from "./sizing";
import { sizeBlocks } from "./size-blocks";
import { fabrics, houseModels } from "./fabrics-archetypes";

export const designStatusEnum = pgEnum("design_status", [
  "DRAFT",
  "BRIEF_COMPLETE",
  "INPUTS_UPLOADED",
  "HERO_GENERATING",
  "HERO_REVIEW",
  "HERO_LOCKED",
  "SIZING",
  "SIZING_LOCKED",
  "ANGLES_GENERATING",
  "ANGLES_REVIEW",
  "ANGLES_LOCKED",
  "COLOURWAYS_GENERATING",
  "COLOURWAYS_REVIEW",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "ARCHIVED",
]);

export const designTagKindEnum = pgEnum("design_tag_kind", [
  "OCCASION",
  "SEASON",
  "WORK",
  "FREE",
]);

export const renderAngleEnum = pgEnum("render_angle", [
  "FRONT",
  "THREE_QUARTER",
  "BACK",
  "DETAIL",
]);

export const customizationInputTypeEnum = pgEnum("customization_input_type", [
  "SELECT",
  "BOOLEAN",
]);

/**
 * Catalog design — entered by hand in Step 21; AI studio attaches later.
 * Status changes go through transition() + design_events.
 */
export const designs = pgTable("designs", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameUr: text("name_ur").notNull().default(""),
  description: text("description"),
  storyCopy: text("story_copy"),
  status: designStatusEnum("status").notNull().default("DRAFT"),
  garmentTypeId: uuid("garment_type_id")
    .notNull()
    .references(() => garmentCategories.id),
  /** e.g. ["KAMEEZ","TROUSER","DUPATTA"] for multi-piece. */
  components: jsonb("components").$type<string[]>().notNull().default([]),
  sizeBlockId: uuid("size_block_id").references(() => sizeBlocks.id),
  /** Per-component fit profile ids. */
  fitProfileIds: jsonb("fit_profile_ids")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  basePriceMinor: integer("base_price_minor").notNull().default(0),
  /** Scheduled sale “was” price — shown struck through when schedule is active. */
  compareAtPriceMinor: integer("compare_at_price_minor"),
  compareAtStartsAt: timestamp("compare_at_starts_at", { withTimezone: true }),
  compareAtEndsAt: timestamp("compare_at_ends_at", { withTimezone: true }),
  madeToMeasureSurchargeMinor: integer("made_to_measure_surcharge_minor")
    .notNull()
    .default(0),
  /** Hundredths of a metre. */
  fabricConsumptionMeters: integer("fabric_consumption_meters")
    .notNull()
    .default(0),
  leadTimeDaysOverride: integer("lead_time_days_override"),
  featured: boolean("featured").notNull().default(false),
  /** Set when REFERENCE_EXTERNAL inputs exist — publish review cannot be skipped. */
  externalReferencesFlagged: boolean("external_references_flagged")
    .notNull()
    .default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  ogAssetId: uuid("og_asset_id").references(() => assets.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const designEvents = createEntityEventsTable("design_events");

export const designTags = pgTable(
  "design_tags",
  {
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    kind: designTagKindEnum("kind").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.designId, t.kind, t.value] })],
);

export const colourways = pgTable(
  "colourways",
  {
    id: uuid("id").primaryKey(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameUr: text("name_ur").notNull().default(""),
    slug: text("slug").notNull(),
    fabricId: uuid("fabric_id")
      .notNull()
      .references(() => fabrics.id),
    hexApproximation: text("hex_approximation"),
    priceDeltaMinor: integer("price_delta_minor").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("colourways_design_slug_uidx").on(t.designId, t.slug)],
);

/**
 * Image-source agnostic — manual upload now, Design Studio later.
 */
export const designRenders = pgTable("design_renders", {
  id: uuid("id").primaryKey(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  colourwayId: uuid("colourway_id")
    .notNull()
    .references(() => colourways.id, { onDelete: "cascade" }),
  angle: renderAngleEnum("angle").notNull(),
  archetypeId: uuid("archetype_id").references(() => houseModels.id),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  altText: text("alt_text").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customizationOptions = pgTable("customization_options", {
  id: uuid("id").primaryKey(),
  designId: uuid("design_id").references(() => designs.id, {
    onDelete: "cascade",
  }),
  categoryId: uuid("category_id").references(() => garmentCategories.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  labelUr: text("label_ur").notNull().default(""),
  inputType: customizationInputTypeEnum("input_type").notNull().default("SELECT"),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customizationOptionValues = pgTable(
  "customization_option_values",
  {
    id: uuid("id").primaryKey(),
    optionId: uuid("option_id")
      .notNull()
      .references(() => customizationOptions.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    label: text("label").notNull(),
    labelUr: text("label_ur").notNull().default(""),
    priceDeltaMinor: integer("price_delta_minor").notNull().default(0),
    referenceAssetId: uuid("reference_asset_id").references(() => assets.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
);
