import fs from "node:fs";
import path from "node:path";

import { sql as drizzleSql } from "drizzle-orm";

import { db } from "@aks/db";

/** Apply step 50 try-on migration when tables were never created. */
export async function ensureTryonSchema(): Promise<void> {
  const result = await db.execute(
    drizzleSql`SELECT to_regclass('public.tryon_sessions') IS NOT NULL AS ready`,
  );
  const ready = Boolean((result as unknown as { ready: boolean }[])[0]?.ready);
  if (ready) return;

  const migrationPath = path.join(
    process.cwd(),
    "packages/db/migrations/0025_step50_tryon.sql",
  );
  const raw = fs.readFileSync(migrationPath, "utf8");
  const statements = raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await db.execute(drizzleSql.raw(statement));
    } catch (error) {
      const message = [
        error instanceof Error ? error.message : String(error),
        error instanceof Error && "cause" in error && error.cause instanceof Error
          ? error.cause.message
          : "",
      ].join(" ");
      if (
        message.includes("already exists") ||
        message.includes("duplicate key")
      ) {
        continue;
      }
      throw error;
    }
  }
}
