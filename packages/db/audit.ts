import type { Database } from "./client";
import { auditLogs } from "./schema/platform";

export type AuditLogInsert = typeof auditLogs.$inferInsert;

/**
 * Append-only writer for audit_logs.
 * There is intentionally no updateAuditLog / deleteAuditLog export.
 */
export async function insertAuditLog(
  db: Database,
  row: AuditLogInsert,
): Promise<void> {
  await db.insert(auditLogs).values(row);
}
