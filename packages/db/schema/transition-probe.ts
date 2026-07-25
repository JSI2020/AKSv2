import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createEntityEventsTable } from "./events";

/**
 * Probe entity for transition() tests (step 7).
 * Not a business domain table.
 */
export const transitionProbeStatus = [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
] as const;

export type TransitionProbeStatus = (typeof transitionProbeStatus)[number];

export const transitionProbes = pgTable("transition_probes", {
  id: uuid("id").primaryKey(),
  status: text("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transitionProbeEvents =
  createEntityEventsTable("transition_probe_events");
