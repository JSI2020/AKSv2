import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./identity";

/** Pakistani provinces — select at checkout, stored as enum. */
export const pakistanProvinceEnum = pgEnum("pakistan_province", [
  "PUNJAB",
  "SINDH",
  "KPK",
  "BALOCHISTAN",
  "GILGIT_BALTISTAN",
  "AJK",
  "ICT",
]);

export type PakistanProvince =
  (typeof pakistanProvinceEnum.enumValues)[number];

/**
 * Saved customer addresses — Pakistani format.
 * Guests checkout with an address snapshot on the order only; signed-in
 * customers may persist rows here.
 */
export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label"),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  province: pakistanProvinceEnum("province").notNull(),
  postalCode: text("postal_code"),
  landmark: text("landmark"),
  isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ShippingAddressSnapshot = {
  recipientName: string;
  phone: string;
  whatsappNumber: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  province: PakistanProvince;
  postalCode?: string | null;
  landmark?: string | null;
};
