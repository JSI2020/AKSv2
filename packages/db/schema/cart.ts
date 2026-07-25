import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { colourways, designs } from "./catalog";
import { users } from "./identity";

export const cartStatusEnum = pgEnum("cart_status", [
  "ACTIVE",
  "CONVERTED",
  "ABANDONED",
]);

export const cartSizeModeEnum = pgEnum("cart_size_mode", [
  "STANDARD",
  "MADE_TO_MEASURE",
]);

export type CartCustomizationSelections = Record<string, string | boolean>;

/**
 * Server-side cart — guests keyed by httpOnly anon cookie; merges on sign-in.
 */
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  anonId: text("anon_id").notNull(),
  status: cartStatusEnum("status").notNull().default("ACTIVE"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cartLines = pgTable("cart_lines", {
  id: uuid("id").primaryKey(),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id),
  colourwayId: uuid("colourway_id")
    .notNull()
    .references(() => colourways.id),
  sizeMode: cartSizeModeEnum("size_mode").notNull(),
  sizeLabel: text("size_label"),
  /** Completed flow session id or saved customer profile id — not an FK. */
  measurementProfileId: uuid("measurement_profile_id"),
  customizationSelections: jsonb("customization_selections")
    .$type<CartCustomizationSelections>()
    .notNull()
    .default({}),
  unitPriceMinor: integer("unit_price_minor").notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
