import fs from "node:fs";
import path from "node:path";

import { sql as drizzleSql } from "drizzle-orm";

import { db } from "@aks/db";

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.execute(
    drizzleSql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${table}
          AND column_name = ${column}
      ) AS ready
    `,
  );
  return Boolean((result as unknown as { ready: boolean }[])[0]?.ready);
}

async function applyMigrationFile(fileName: string): Promise<void> {
  const migrationPath = path.join(
    process.cwd(),
    `packages/db/migrations/${fileName}`,
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

/** Apply step 43 inventory migration when tables were never created. */
export async function ensureInventorySchema(): Promise<void> {
  const ready = await columnExists("fabrics", "reorder_point_meters");
  if (!ready) {
    await applyMigrationFile("0021_step43_fabric_lots.sql");
    return;
  }

  const lotsReady = await db.execute(
    drizzleSql`SELECT to_regclass('public.fabric_lots') IS NOT NULL AS ready`,
  );
  const hasLots = Boolean(
    (lotsReady as unknown as { ready: boolean }[])[0]?.ready,
  );
  if (!hasLots) {
    await applyMigrationFile("0021_step43_fabric_lots.sql");
  }
}

/** Ensure designs table matches schema used by order/inventory tests. */
export async function ensureDesignSchemaForTests(): Promise<void> {
  const ready = await columnExists("designs", "external_references_flagged");
  if (!ready) {
    await applyMigrationFile("0018_step38_design_inputs.sql");
  }

  const consumptionReady = await columnExists(
    "designs",
    "fabric_consumption_meters",
  );
  if (!consumptionReady) {
    await db.execute(
      drizzleSql`ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "fabric_consumption_meters" integer DEFAULT 0 NOT NULL`,
    );
  }
}
