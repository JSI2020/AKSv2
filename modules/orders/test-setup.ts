import fs from "node:fs";
import path from "node:path";

import { sql as drizzleSql } from "drizzle-orm";

import { db } from "@aks/db";

/** Apply orders migrations when tables were never created. */
export async function ensureOrdersSchema(): Promise<void> {
  const migrationFiles = [
    "0011_orange_madame_hydra.sql",
    "0012_order_admin.sql",
    "0015_step34_production_pipeline.sql",
  ];

  for (const file of migrationFiles) {
    const tableCheck =
      file === "0011_orange_madame_hydra.sql"
        ? "orders"
        : file === "0012_order_admin.sql"
          ? "order_payments"
          : "message_templates";
    const result = await db.execute(
      drizzleSql`SELECT to_regclass(${`public.${tableCheck}`}) IS NOT NULL AS ready`,
    );
    const ready = Boolean((result as unknown as { ready: boolean }[])[0]?.ready);
    if (ready) continue;

    const migrationPath = path.join(
      process.cwd(),
      `packages/db/migrations/${file}`,
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
}
