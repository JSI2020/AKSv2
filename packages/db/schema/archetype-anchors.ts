import { integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { houseModels } from "./fabrics-archetypes";

/**
 * Per-archetype overlay calibration — anchor Y as hundredths of a percent of image
 * height from the top (1200 = 12.00%). Authored once per category + measurement key.
 */
export const archetypeAnchorPoints = pgTable(
  "archetype_anchor_points",
  {
    archetypeId: uuid("archetype_id")
      .notNull()
      .references(() => houseModels.id, { onDelete: "cascade" }),
    categoryKey: text("category_key").notNull(),
    measurementKey: text("measurement_key").notNull(),
    anchorYBp: integer("anchor_y_bp").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.archetypeId, t.categoryKey, t.measurementKey],
    }),
  ],
);
