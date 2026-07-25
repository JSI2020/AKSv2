import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { assets } from "./platform";
import { users } from "./identity";
import { orders } from "./orders";

export const paymentProviderEnum = pgEnum("payment_provider", [
  "SAFEPAY",
  "JAZZCASH",
  "EASYPAISA",
  "BANK_TRANSFER",
  "COD",
  "CASH",
]);

export const paymentKindEnum = pgEnum("payment_kind", [
  "DEPOSIT",
  "BALANCE",
  "FULL",
  "REFUND",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
  "AWAITING_VERIFICATION",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

/** Provider ledger — Safepay webhooks and automated captures. */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    providerRef: text("provider_ref"),
    kind: paymentKindEnum("kind").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("PKR"),
    status: paymentStatusEnum("status").notNull(),
    rawPayload: jsonb("raw_payload"),
    idempotencyKey: text("idempotency_key").notNull(),
    receiptAssetId: uuid("receipt_asset_id").references(() => assets.id),
    verifiedById: uuid("verified_by_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_idempotency_key_unique").on(table.idempotencyKey),
  ],
);

/** Courier COD settlement batches — matched against delivered orders. */
export const codRemittances = pgTable("cod_remittances", {
  id: uuid("id").primaryKey(),
  courier: text("courier").notNull(),
  remittanceRef: text("remittance_ref").notNull(),
  expectedAmountMinor: integer("expected_amount_minor").notNull(),
  receivedAmountMinor: integer("received_amount_minor").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  orderIds: jsonb("order_ids").$type<string[]>().notNull(),
  discrepancyNote: text("discrepancy_note"),
  recordedById: uuid("recorded_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amountMinor: integer("amount_minor").notNull(),
  reason: text("reason").notNull(),
  status: refundStatusEnum("status").notNull(),
  providerRef: text("provider_ref"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
