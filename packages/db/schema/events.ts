import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Generic append-only events shape for entity state machines.
 * Use createEntityEventsTable("order_events") per entity.
 */
export function createEntityEventsTable(tableName: string) {
  return pgTable(tableName, {
    id: uuid("id").primaryKey(),
    entityId: uuid("entity_id").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorId: uuid("actor_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type EntityEventsTable = ReturnType<typeof createEntityEventsTable>;
