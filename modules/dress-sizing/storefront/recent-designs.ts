import { desc } from "drizzle-orm";
import type { Database } from "@/packages/db";
import { dressStyle } from "@/packages/db/schema";
import { RECENT_DESIGN_LIMIT } from "./recent";
export function listRecentDesigns(db: Database) {
  return db.select().from(dressStyle).orderBy(desc(dressStyle.id)).limit(RECENT_DESIGN_LIMIT);
}
