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
import { orderItems, orders } from "./orders";
import { fabrics } from "./fabrics-archetypes";
import { colourways, designs } from "./catalog";

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

export const trimKindEnum = pgEnum("trim_kind", [
  "BUTTON",
  "ZIP",
  "LINING",
  "HOOK",
  "THREAD",
  "OTHER",
]);

export const inventoryMovementReasonEnum = pgEnum("inventory_movement_reason", [
  "RECEIVED",
  "SOLD_OFFLINE",
  "DAMAGE",
  "COUNT_CORRECTION",
  "ORDER_DISPATCH",
]);

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

/** Explicit colour entity for a fabric — lots sit under a colourway. */
export const fabricColourways = pgTable(
  "fabric_colourways",
  {
    id: uuid("id").primaryKey(),
    fabricId: uuid("fabric_id")
      .notNull()
      .references(() => fabrics.id, { onDelete: "cascade" }),
    colourName: text("colour_name").notNull(),
    hexApproximation: text("hex_approximation"),
    swatchAssetId: uuid("swatch_asset_id").references(() => assets.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("fabric_colourways_fabric_name_uidx").on(
      t.fabricId,
      t.colourName,
    ),
  ],
);

export const fabricLots = pgTable(
  "fabric_lots",
  {
    id: uuid("id").primaryKey(),
    fabricId: uuid("fabric_id")
      .notNull()
      .references(() => fabrics.id),
    colourwayId: uuid("colourway_id").references(() => fabricColourways.id),
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
    /** @deprecated prefer colourwayId — kept for back-compat. */
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

/** Ready-to-wear: design × colourway × size. */
export const rtwStock = pgTable(
  "rtw_stock",
  {
    id: uuid("id").primaryKey(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    colourwayId: uuid("colourway_id")
      .notNull()
      .references(() => colourways.id, { onDelete: "cascade" }),
    sizeLabel: text("size_label").notNull(),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    reorderPoint: integer("reorder_point").notNull().default(2),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("rtw_stock_design_cw_size_uidx").on(
      t.designId,
      t.colourwayId,
      t.sizeLabel,
    ),
  ],
);

export const rtwMovements = pgTable("rtw_movements", {
  id: uuid("id").primaryKey(),
  rtwStockId: uuid("rtw_stock_id")
    .notNull()
    .references(() => rtwStock.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: inventoryMovementReasonEnum("reason").notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  note: text("note"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const packingMaterials = pgTable("packing_materials", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  photoAssetId: uuid("photo_asset_id").references(() => assets.id),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  quantityReserved: integer("quantity_reserved").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  costPerUnitMinor: integer("cost_per_unit_minor").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const packingMovements = pgTable("packing_movements", {
  id: uuid("id").primaryKey(),
  packingMaterialId: uuid("packing_material_id")
    .notNull()
    .references(() => packingMaterials.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: inventoryMovementReasonEnum("reason").notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  note: text("note"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trims = pgTable("trims", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  /** Legacy free-text type — prefer `kind`. */
  type: text("type").notNull().default("OTHER"),
  kind: trimKindEnum("kind").notNull().default("OTHER"),
  hasColourVariants: boolean("has_colour_variants").notNull().default(false),
  photoAssetId: uuid("photo_asset_id").references(() => assets.id),
  unit: trimUnitEnum("unit").notNull().default("PIECE"),
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

export const trimColourways = pgTable(
  "trim_colourways",
  {
    id: uuid("id").primaryKey(),
    trimId: uuid("trim_id")
      .notNull()
      .references(() => trims.id, { onDelete: "cascade" }),
    colourName: text("colour_name").notNull(),
    hexApproximation: text("hex_approximation"),
    swatchAssetId: uuid("swatch_asset_id").references(() => assets.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trim_colourways_trim_name_uidx").on(t.trimId, t.colourName),
  ],
);

export const trimStock = pgTable(
  "trim_stock",
  {
    id: uuid("id").primaryKey(),
    trimId: uuid("trim_id")
      .notNull()
      .references(() => trims.id, { onDelete: "cascade" }),
    trimColourwayId: uuid("trim_colourway_id").references(
      () => trimColourways.id,
      { onDelete: "cascade" },
    ),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    reorderPoint: integer("reorder_point").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trim_stock_trim_cw_uidx").on(t.trimId, t.trimColourwayId),
  ],
);

export const trimMovements = pgTable("trim_movements", {
  id: uuid("id").primaryKey(),
  trimStockId: uuid("trim_stock_id")
    .notNull()
    .references(() => trimStock.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: inventoryMovementReasonEnum("reason").notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  note: text("note"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
