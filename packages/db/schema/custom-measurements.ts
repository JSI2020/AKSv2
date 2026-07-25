import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { CrossFieldRule } from "@aks/shared";

import { designs } from "./catalog";
import { users } from "./identity";
import { garmentCategories, measurementKeys } from "./sizing";

/** Re-export for Drizzle jsonb typing — canonical type lives in @aks/shared. */
export type { CrossFieldRule };

/**
 * Admin-configurable min/max/step per category + measurement key.
 * Values are integer hundredths of an inch — never floats.
 */
export const customSizeLimits = pgTable(
  "custom_size_limits",
  {
    id: uuid("id").primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => garmentCategories.id),
    measurementKey: text("measurement_key")
      .notNull()
      .references(() => measurementKeys.key),
    minValue: integer("min_value").notNull(),
    maxValue: integer("max_value").notNull(),
    step: integer("step").notNull().default(25),
    crossFieldRules: jsonb("cross_field_rules")
      .$type<CrossFieldRule[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("custom_size_limits_category_key_uidx").on(
      t.categoryId,
      t.measurementKey,
    ),
  ],
);

/** Saved measurement set for a signed-in customer — reusable at checkout. */
export const customerMeasurementProfiles = pgTable(
  "customer_measurement_profiles",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => garmentCategories.id),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const customerMeasurements = pgTable(
  "customer_measurements",
  {
    id: uuid("id").primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => customerMeasurementProfiles.id, {
        onDelete: "cascade",
      }),
    measurementKey: text("measurement_key").notNull(),
    valueInches: integer("value_inches").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customer_measurements_profile_key_uidx").on(
      t.profileId,
      t.measurementKey,
    ),
  ],
);

/** Resumable in-progress MTM flow — autosaved server-side. */
export const measurementFlowSessions = pgTable("measurement_flow_sessions", {
  id: uuid("id").primaryKey(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  anonToken: text("anon_token"),
  currentStepIndex: integer("current_step_index").notNull().default(0),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  saveToProfile: boolean("save_to_profile").notNull().default(false),
  profileLabel: text("profile_label"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const measurementFlowValues = pgTable(
  "measurement_flow_values",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => measurementFlowSessions.id, { onDelete: "cascade" }),
    componentKey: text("component_key").notNull(),
    measurementKey: text("measurement_key").notNull(),
    valueInches: integer("value_inches").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("measurement_flow_values_session_key_uidx").on(
      t.sessionId,
      t.componentKey,
      t.measurementKey,
    ),
  ],
);
