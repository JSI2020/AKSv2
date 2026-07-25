import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./identity";
import { garmentCategories } from "./sizing";

/**
 * Standard (or design-forked) size chart header.
 * Unpinned cell values are NEVER stored — only computed on read.
 */
export const sizeBlocks = pgTable("size_blocks", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => garmentCategories.id),
  isDefault: boolean("is_default").notNull().default(false),
  /** Set when a design forks the category default. No designs table yet — uuid only. */
  ownerDesignId: uuid("owner_design_id"),
  sizeLabels: text("size_labels").array().notNull(),
  baseSizeLabel: text("base_size_label").notNull(),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One row per measurement key in a block.
 * Values are integer hundredths of an inch.
 * gradeOverrides: per-size-label step override, e.g. { "XL": 300, "XXL": 300 }.
 */
export const sizeBlockRows = pgTable(
  "size_block_rows",
  {
    id: uuid("id").primaryKey(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => sizeBlocks.id, { onDelete: "cascade" }),
    measurementKey: text("measurement_key").notNull(),
    baseValue: integer("base_value").notNull(),
    gradeIncrement: integer("grade_increment").notNull(),
    gradeOverrides: jsonb("grade_overrides")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("size_block_rows_block_key_uidx").on(
      t.blockId,
      t.measurementKey,
    ),
  ],
);

/**
 * ONLY pinned manual overrides. Unpinned values are computed on read
 * from baseValue + Σ(increments) and must never be persisted.
 */
export const sizeBlockCells = pgTable(
  "size_block_cells",
  {
    blockId: uuid("block_id")
      .notNull()
      .references(() => sizeBlocks.id, { onDelete: "cascade" }),
    measurementKey: text("measurement_key").notNull(),
    sizeLabel: text("size_label").notNull(),
    value: integer("value").notNull(),
    isPinned: boolean("is_pinned").notNull().default(true),
    editedById: uuid("edited_by_id").references(() => users.id),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({
      columns: [t.blockId, t.measurementKey, t.sizeLabel],
    }),
  ],
);
