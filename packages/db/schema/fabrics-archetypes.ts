import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { assets } from "./platform";

export const drapeClassEnum = pgEnum("drape_class", [
  "LIGHT",
  "MEDIUM",
  "HEAVY",
]);

/**
 * Minimal fabric record — lots/suppliers added later without altering this table.
 * Money: costPerMeterMinor (paisa). Width/shrinkage: hundredths of an inch.
 * stretchPercent: integer 0–100.
 */
export const fabrics = pgTable("fabrics", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  composition: text("composition").notNull(),
  weightGsm: integer("weight_gsm"),
  widthInches: integer("width_inches").notNull(),
  swatchAssetId: uuid("swatch_asset_id").references(() => assets.id),
  careInstructions: text("care_instructions"),
  drapeNotes: text("drape_notes"),
  costPerMeterMinor: integer("cost_per_meter_minor").notNull().default(0),
  stretchPercent: integer("stretch_percent").notNull().default(0),
  shrinkageAllowance: integer("shrinkage_allowance").notNull().default(0),
  drapeClass: drapeClassEnum("drape_class").notNull().default("MEDIUM"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * House model archetypes — measurements are authored, never inferred from images.
 * isAiGenerated must always be true (licensing).
 */
export const houseModels = pgTable("house_models", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  active: boolean("active").notNull().default(true),
  heightCm: integer("height_cm").notNull(),
  /** Hundredths of an inch. */
  heightInches: integer("height_inches").notNull(),
  bust: integer("bust").notNull(),
  waist: integer("waist").notNull(),
  hip: integer("hip").notNull(),
  shoulder: integer("shoulder").notNull(),
  wearsSizeLabel: text("wears_size_label").notNull(),
  buildDescription: text("build_description"),
  identitySeed: text("identity_seed").notNull(),
  referenceAssetIds: uuid("reference_asset_ids").array().notNull().default([]),
  isAiGenerated: boolean("is_ai_generated").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
