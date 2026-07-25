import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { garmentCategories } from "./sizing";

/**
 * Silhouette ease profiles — one body chart + many fit profiles.
 * easeByMeasurement: hundredths of an inch.
 * clingFactorBps: 0–100 (basis points of cling; 30 = 0.30). Stored for 3D guide later.
 */
export const fitProfiles = pgTable("fit_profiles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => garmentCategories.id),
  easeByMeasurement: jsonb("ease_by_measurement")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  clingFactorBps: integer("cling_factor_bps").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
