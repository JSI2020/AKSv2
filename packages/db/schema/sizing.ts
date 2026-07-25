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

export const bodyOrGarmentEnum = pgEnum("body_or_garment", ["BODY", "GARMENT"]);

/**
 * Catalogue of every measurable dimension.
 * Values elsewhere are integer hundredths of an inch — never floats.
 */
export const measurementKeys = pgTable("measurement_keys", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  labelUr: text("label_ur").notNull(),
  bodyOrGarment: bodyOrGarmentEnum("body_or_garment").notNull(),
  anchorPoint: text("anchor_point").notNull(),
  helpText: text("help_text").notNull(),
  demoVideoAssetId: uuid("demo_video_asset_id").references(() => assets.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Garment type → which measurement keys apply.
 * One body chart per category; length is a design decision, not a separate category.
 */
export const garmentCategories = pgTable("garment_categories", {
  id: uuid("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  nameUr: text("name_ur").notNull(),
  measurementKeys: text("measurement_keys").array().notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
