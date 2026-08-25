import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./identity";

/** Fixed singleton row id — photoreal_settings holds one row only. */
export const PHOTOREAL_SETTINGS_SINGLETON_ID =
  "01900000-0000-7000-8000-000000000003";

export const photorealSettings = pgTable("photoreal_settings", {
  id: uuid("id").primaryKey(),
  preferredHouseModelId: text("preferred_house_model_id").notNull(),
  generateModel: text("generate_model").notNull(),
  refineModel: text("refine_model").notNull(),
  lockSeed: boolean("lock_seed").notNull().default(true),
  /** Optional monthly spend reminder in USD cents. */
  monthlySpendReminderUsdCents: integer("monthly_spend_reminder_usd_cents"),
  personaDescription: text("persona_description").notNull(),
  personaSeed: integer("persona_seed").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const photorealDesigns = pgTable("photoreal_designs", {
  id: uuid("id").primaryKey(),
  title: text("title"),
  description: text("description"),
  shirtColour: text("shirt_colour"),
  trouserColour: text("trouser_colour"),
  fabric: text("fabric"),
  sketchUrls: jsonb("sketch_urls").$type<string[]>().notNull().default([]),
  oldDesignUrl: text("old_design_url"),
  houseModelId: text("house_model_id"),
  houseModelName: text("house_model_name"),
  /** USD micro-dollars (1 USD = 1_000_000). */
  totalCostUsdMicros: integer("total_cost_usd_micros").notNull().default(0),
  createdById: uuid("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const photorealVersions = pgTable("photoreal_versions", {
  id: uuid("id").primaryKey(),
  designId: uuid("design_id")
    .notNull()
    .references(() => photorealDesigns.id, { onDelete: "cascade" }),
  parentVersionId: uuid("parent_version_id"),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  seed: integer("seed"),
  modelId: text("model_id").notNull(),
  feedback: text("feedback"),
  /** USD micro-dollars (1 USD = 1_000_000). */
  costUsdMicros: integer("cost_usd_micros").notNull().default(0),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
