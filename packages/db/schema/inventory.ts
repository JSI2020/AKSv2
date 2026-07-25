import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./identity";
import { assets } from "./platform";
import { orderItems } from "./orders";
import { fabrics } from "./fabrics-archetypes";

export const fabricLotStatusEnum = pgEnum("fabric_lot_status", [
  "AVAILABLE",
  "LOW",
  "DEPLETED",
  "QUARANTINED",
]);

export const fabricReservationStatusEnum = pgEnum("fabric_reservation_status", [
  "RESERVED",
  "CONSUMED",
  "RELEASED",
]);

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "DRAFT",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

export const stockAdjustmentReasonEnum = pgEnum("stock_adjustment_reason", [
  "DAMAGE",
  "SAMPLING",
  "COUNT_CORRECTION",
  "CUTTING_WASTE",
  "RETURN",
  "OTHER",
]);

export const trimUnitEnum = pgEnum("trim_unit", ["PIECE", "METRE", "SPOOL"]);

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  paymentTerms: text("payment_terms"),
  leadTimeDays: integer("lead_time_days"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  status: purchaseOrderStatusEnum("status").notNull().default("DRAFT"),
  orderedAt: timestamp("ordered_at", { withTimezone: true }),
  expectedAt: timestamp("expected_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  totalMinor: integer("total_minor").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: uuid("id").primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  fabricId: uuid("fabric_id")
    .notNull()
    .references(() => fabrics.id),
  /** Hundredths of a metre. */
  metersOrdered: integer("meters_ordered").notNull(),
  /** Hundredths of a metre. */
  metersReceived: integer("meters_received").notNull().default(0),
  unitCostMinor: integer("unit_cost_minor").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fabricLots = pgTable(
  "fabric_lots",
  {
    id: uuid("id").primaryKey(),
    fabricId: uuid("fabric_id")
      .notNull()
      .references(() => fabrics.id),
    lotCode: text("lot_code").notNull(),
    dyeLotRef: text("dye_lot_ref"),
    /** Hundredths of a metre. */
    metersReceived: integer("meters_received").notNull(),
    /** Hundredths of a metre. */
    metersOnHand: integer("meters_on_hand").notNull(),
    /** Hundredths of a metre. */
    metersReserved: integer("meters_reserved").notNull().default(0),
    costPerMeterMinor: integer("cost_per_meter_minor").notNull().default(0),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    purchaseOrderId: uuid("purchase_order_id").references(
      () => purchaseOrders.id,
    ),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    colourNotes: text("colour_notes"),
    swatchAssetId: uuid("swatch_asset_id").references(() => assets.id),
    status: fabricLotStatusEnum("status").notNull().default("AVAILABLE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("fabric_lots_fabric_lot_code_uidx").on(t.fabricId, t.lotCode),
  ],
);

export const fabricReservations = pgTable("fabric_reservations", {
  id: uuid("id").primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  fabricLotId: uuid("fabric_lot_id")
    .notNull()
    .references(() => fabricLots.id),
  /** Hundredths of a metre. */
  metersReserved: integer("meters_reserved").notNull(),
  status: fabricReservationStatusEnum("status").notNull().default("RESERVED"),
  reservedAt: timestamp("reserved_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  /** Hundredths of a metre — set at cutting. */
  actualMetersConsumed: integer("actual_meters_consumed"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Append-only — never expose update/delete paths. */
export const stockAdjustments = pgTable("stock_adjustments", {
  id: uuid("id").primaryKey(),
  fabricLotId: uuid("fabric_lot_id")
    .notNull()
    .references(() => fabricLots.id),
  /** Signed hundredths of a metre. */
  deltaMeters: integer("delta_meters").notNull(),
  reason: stockAdjustmentReasonEnum("reason").notNull(),
  note: text("note"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trims = pgTable("trims", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  unit: trimUnitEnum("unit").notNull(),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  quantityReserved: integer("quantity_reserved").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  costPerUnitMinor: integer("cost_per_unit_minor").notNull().default(0),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
