import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Trivial probe table — proves the migration pipeline.
 * Removed or ignored once real schema lands in step 4.
 */
export const pipelineProbe = pgTable("pipeline_probe", {
  id: uuid("id").primaryKey(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
