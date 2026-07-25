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

import { users } from "./identity";
import { orderItems } from "./orders";

export const staffRoleEnum = pgEnum("staff_role", [
  "CUTTER",
  "STITCHER",
  "EMBROIDERER",
  "FINISHER",
  "QC",
]);

export const productionJobStageEnum = pgEnum("production_job_stage", [
  "CUTTING",
  "STITCHING",
  "EMBROIDERY",
  "FINISHING",
  "QC",
  "PACKED",
]);

export const productionJobStatusEnum = pgEnum("production_job_status", [
  "PENDING",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
]);

export const qcCheckResultEnum = pgEnum("qc_check_result", ["PASS", "FAIL"]);

export const reworkFaultAttributionEnum = pgEnum("rework_fault_attribution", [
  "OUR_ERROR",
  "CUSTOMER_MEASUREMENT",
  "FABRIC_DEFECT",
  "UNDETERMINED",
]);

export const reworkOrderStatusEnum = pgEnum("rework_order_status", [
  "PENDING",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED",
]);

/** Workshop karigars — capacity drives workload warnings. */
export const staff = pgTable("staff", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: staffRoleEnum("role").notNull(),
  /** Garments or jobs per week — integer count. */
  capacityPerWeek: integer("capacity_per_week").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** One active job per order item on the production board. */
export const productionJobs = pgTable("production_jobs", {
  id: uuid("id").primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  stage: productionJobStageEnum("stage").notNull().default("CUTTING"),
  assignedToId: uuid("assigned_to_id").references(() => staff.id, {
    onDelete: "set null",
  }),
  status: productionJobStatusEnum("status").notNull().default("PENDING"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  blockedReason: text("blocked_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Append-only stage history — written via transition(). */
export const productionJobEvents = pgTable("production_job_events", {
  id: uuid("id").primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => productionJobs.id, { onDelete: "cascade" }),
  fromStage: productionJobStageEnum("from_stage").notNull(),
  toStage: productionJobStageEnum("to_stage").notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type QcChecklist = Record<string, "pass" | "fail">;

export const qcChecks = pgTable("qc_checks", {
  id: uuid("id").primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => productionJobs.id, { onDelete: "cascade" }),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  checklist: jsonb("checklist").$type<QcChecklist>().notNull(),
  result: qcCheckResultEnum("result").notNull(),
  photoAssetIds: jsonb("photo_asset_ids").$type<string[]>().notNull().default([]),
  inspectorId: uuid("inspector_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reworkOrders = pgTable("rework_orders", {
  id: uuid("id").primaryKey(),
  originalOrderItemId: uuid("original_order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  originalJobId: uuid("original_job_id").references(() => productionJobs.id, {
    onDelete: "set null",
  }),
  reason: text("reason").notNull(),
  faultAttribution: reworkFaultAttributionEnum("fault_attribution").notNull(),
  costMinor: integer("cost_minor").notNull().default(0),
  chargeCustomer: boolean("charge_customer").notNull().default(false),
  status: reworkOrderStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
