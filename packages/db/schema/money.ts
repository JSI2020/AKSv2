import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { designs } from "./catalog";
import { fabrics } from "./fabrics-archetypes";
import { users } from "./identity";

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

/** Fixed overhead — domain, hosting, tools, etc. @deprecated Prefer expenditures. */
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

export const expenditureCategoryEnum = pgEnum("expenditure_category", [
  "RENT",
  "SALARIES",
  "MARKETING",
  "UTILITIES",
  "SOFTWARE",
  "EQUIPMENT",
  "MATERIALS",
  "TAXES",
  "OTHER",
]);

export const expenditurePaymentMethodEnum = pgEnum(
  "expenditure_payment_method",
  ["CASH", "BANK_TRANSFER", "CARD"],
);

export const expenditureRecurrenceEnum = pgEnum("expenditure_recurrence", [
  "MONTHLY",
  "YEARLY",
]);

/**
 * Operating expenditure ledger — replaces the static recurring_costs UI.
 * Recurring rows expand into each period until endedAt.
 */
export const expenditures = pgTable("expenditures", {
  id: uuid("id").primaryKey(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  category: expenditureCategoryEnum("category").notNull(),
  payee: text("payee").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  paymentMethod: expenditurePaymentMethodEnum("payment_method").notNull(),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceCycle: expenditureRecurrenceEnum("recurrence_cycle"),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  note: text("note"),
  receiptAssetId: uuid("receipt_asset_id"),
  actorId: uuid("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
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
  /** Allocated shipping / fulfillment overhead (paisa). */
  shippingMinor: integer("shipping_minor").notNull().default(0),
  /** Studio / admin overhead allocation (paisa). */
  overheadMinor: integer("overhead_minor").notNull().default(0),
  /**
   * DETAILED_PER_PIECE | PIECE_LUMPSUM | TOTAL_LUMPSUM
   */
  costingMode: text("costing_mode").notNull().default("DETAILED_PER_PIECE"),
  /** Per-piece cost lines (json). Aggregated into fabric/stitching/embroidery on save. */
  pieceCosts: jsonb("piece_costs")
    .$type<
      Array<{
        componentKey: string;
        mode: "DETAILED" | "LUMPSUM";
        fabricId?: string | null;
        fabricMeters?: number;
        stitchingRateId?: string | null;
        stitchingFlatMinor?: number | null;
        embroideryRateId?: string | null;
        embroideryFlatMinor?: number | null;
        lumpsumMinor?: number | null;
      }>
    >()
    .notNull()
    .default([]),
  totalLumpsumMinor: integer("total_lumpsum_minor"),
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
