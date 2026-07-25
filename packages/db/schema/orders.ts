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

import type { ShippingAddressSnapshot } from "./addresses";
import { users } from "./identity";
import { createEntityEventsTable } from "./events";

export const orderStatusEnum = pgEnum("order_status", [
  "DRAFT",
  "AWAITING_DEPOSIT",
  "DEPOSIT_PAID",
  "MEASUREMENTS_CONFIRMED",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "READY_TO_SHIP",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "DELIVERY_REFUSED",
  "WRITE_OFF",
]);

export const paymentPlanEnum = pgEnum("payment_plan", [
  "FULL_PREPAID",
  "DEPOSIT_50_COD_50",
  "DEPOSIT_70_COD_30",
]);

export const orderSourceEnum = pgEnum("order_source", [
  "WEB",
  "WHATSAPP",
  "INSTAGRAM",
  "PHONE",
  "WALK_IN",
]);

export const orderSizeModeEnum = pgEnum("order_size_mode", [
  "STANDARD",
  "MADE_TO_MEASURE",
]);

export type OrderDesignSnapshot = {
  name: string;
  slug: string;
  thumbnailUrl?: string | null;
};

export type OrderMeasurementSnapshot = {
  sessionId: string;
  values: Record<string, number>;
} | null;

export type OrderCustomizationSnapshot = Record<string, string | boolean>;

export type OrderPriceBreakdownSnapshot = {
  basePriceMinor: number;
  colourwayDeltaMinor: number;
  customizationDeltaMinor: number;
  madeToMeasureSurchargeMinor: number;
  unitPriceMinor: number;
};

export type OrderCutSpecSnapshot = Record<string, number> | null;

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  whatsappNumber: text("whatsapp_number").notNull(),
  status: orderStatusEnum("status").notNull().default("DRAFT"),
  currency: text("currency").notNull().default("PKR"),
  subtotalMinor: integer("subtotal_minor").notNull(),
  discountMinor: integer("discount_minor").notNull().default(0),
  shippingMinor: integer("shipping_minor").notNull().default(0),
  taxMinor: integer("tax_minor").notNull().default(0),
  totalMinor: integer("total_minor").notNull(),
  depositAmountMinor: integer("deposit_amount_minor").notNull(),
  balanceAmountMinor: integer("balance_amount_minor").notNull(),
  paymentPlan: paymentPlanEnum("payment_plan").notNull(),
  promisedShipDate: timestamp("promised_ship_date", { withTimezone: true }),
  shippingAddressSnapshot: jsonb("shipping_address_snapshot")
    .$type<ShippingAddressSnapshot>()
    .notNull(),
  customerNotes: text("customer_notes"),
  internalNotes: text("internal_notes"),
  source: orderSourceEnum("source").notNull().default("WEB"),
  cartId: uuid("cart_id"),
  placedAt: timestamp("placed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  designId: uuid("design_id").notNull(),
  colourwayId: uuid("colourway_id").notNull(),
  designSnapshot: jsonb("design_snapshot").$type<OrderDesignSnapshot>().notNull(),
  sizeMode: orderSizeModeEnum("size_mode").notNull(),
  sizeLabel: text("size_label"),
  measurementSnapshot: jsonb("measurement_snapshot")
    .$type<OrderMeasurementSnapshot>()
    .notNull(),
  customizationSnapshot: jsonb("customization_snapshot")
    .$type<OrderCustomizationSnapshot>()
    .notNull(),
  priceBreakdownSnapshot: jsonb("price_breakdown_snapshot")
    .$type<OrderPriceBreakdownSnapshot>()
    .notNull(),
  cutSpecSnapshot: jsonb("cut_spec_snapshot")
    .$type<OrderCutSpecSnapshot>(),
  unitPriceMinor: integer("unit_price_minor").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalMinor: integer("line_total_minor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderEvents = createEntityEventsTable("order_events");

export const orderPaymentKindEnum = pgEnum("order_payment_kind", [
  "DEPOSIT",
  "BALANCE",
  "FULL",
  "REFUND",
]);

export const orderPaymentProviderEnum = pgEnum("order_payment_provider", [
  "BANK_TRANSFER",
  "CASH",
  "JAZZCASH",
  "EASYPAISA",
  "COD",
  "SAFEPAY",
  "OTHER",
]);

export const orderPaymentStatusEnum = pgEnum("order_payment_status", [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "AWAITING_VERIFICATION",
  "REFUNDED",
]);

/** Recorded payments against an order — append-only. */
export const orderPayments = pgTable("order_payments", {
  id: uuid("id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  kind: orderPaymentKindEnum("kind").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  provider: orderPaymentProviderEnum("provider").notNull(),
  status: orderPaymentStatusEnum("status").notNull().default("SUCCEEDED"),
  note: text("note"),
  recordedById: uuid("recorded_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Stage photos attached to an order — append-only. */
export const orderPhotos = pgTable("order_photos", {
  id: uuid("id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  assetId: uuid("asset_id").notNull(),
  isCustomerVisible: boolean("is_customer_visible").notNull().default(false),
  uploadedById: uuid("uploaded_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
