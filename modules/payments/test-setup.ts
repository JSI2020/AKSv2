import fs from "node:fs";
import path from "node:path";

import { sql as drizzleSql } from "drizzle-orm";

import { db } from "@aks/db";

const MIGRATION_FILES = [
  { file: "0011_orange_madame_hydra.sql", table: "orders" },
  { file: "0012_order_admin.sql", table: "order_payments" },
  { file: "0013_payments.sql", table: "payments" },
  { file: "0014_step33_bank_transfer_cod.sql", table: "customer_profiles" },
] as const;

/** Apply payment migrations when tables were never created. */
export async function ensurePaymentsSchema(): Promise<void> {
  for (const { file, table } of MIGRATION_FILES) {
    const result = await db.execute(
      drizzleSql`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS ready`,
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
