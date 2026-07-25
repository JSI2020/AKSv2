import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { designs } from "./catalog";
import { fabrics } from "./fabrics-archetypes";

export const rateKindEnum = pgEnum("rate_kind", [
  "STITCHING",
  "EMBROIDERY",
  "PACKAGING",
]);

export const rateUnitEnum = pgEnum("rate_unit", ["FLAT", "PER_HOUR", "PER_METRE"]);

export const recurringCostCycleEnum = pgEnum("recurring_cost_cycle", [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
]);

/** Stitching, embroidery, packaging rates — feed design costing dropdowns. */
export const rates = pgTable("rates", {
  id: uuid("id").primaryKey(),
  kind: rateKindEnum("kind").notNull(),
  name: text("name").notNull(),
  /** PKR paisa per unit (flat, hour, or metre depending on unit). */
  amountMinor: integer("amount_minor").notNull(),
  unit: rateUnitEnum("unit").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Fixed overhead — domain, hosting, tools, etc. */
export const recurringCosts = pgTable("recurring_costs", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  cycle: recurringCostCycleEnum("cycle").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per-design cost breakdown. totalCostMinor and marginPercent are computed on save —
 * never typed by the user.
 */
export const designCosts = pgTable("design_costs", {
  designId: uuid("design_id")
    .primaryKey()
    .references(() => designs.id, { onDelete: "cascade" }),
  fabricId: uuid("fabric_id")
    .notNull()
    .references(() => fabrics.id),
  /** Hundredths of a metre. */
  fabricMeters: integer("fabric_meters").notNull().default(0),
  embroideryRateId: uuid("embroidery_rate_id").references(() => rates.id),
  embroideryFlatMinor: integer("embroidery_flat_minor"),
  stitchingRateId: uuid("stitching_rate_id").references(() => rates.id),
  stitchingFlatMinor: integer("stitching_flat_minor"),
  packagingMinor: integer("packaging_minor").notNull().default(0),
  /** PKR paisa — converted from design_generations USD spend on save. */
  aiCostMinor: integer("ai_cost_minor").notNull().default(0),
  totalCostMinor: integer("total_cost_minor").notNull().default(0),
  sellingPriceMinor: integer("selling_price_minor").notNull().default(0),
  /** Integer hundredths of a percent (2543 = 25.43%). Computed, never typed. */
  marginPercent: integer("margin_percent").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
