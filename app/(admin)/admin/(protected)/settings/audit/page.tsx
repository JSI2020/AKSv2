import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auditLogs, db, users } from "@aks/db";
import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  requirePermission,
  UnauthenticatedError,
} from "@/modules/auth";

function summarise(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) return "";
  return keys.slice(0, 6).join(", ");
}

export default async function AuditLogPage() {
  try {
    await requirePermission("settings.view");
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect("/admin/login");
    if (e instanceof PermissionDeniedError) redirect("/admin");
    throw e;
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      actorRole: auditLogs.actorRole,
      before: auditLogs.before,
      after: auditLogs.after,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="text-ink/55">Settings</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-light text-ink">
          Audit log
        </h1>
        <p className="mt-2 max-w-xl text-[13px] text-ink/55">
          Who changed what. The latest 200 entries, newest first. This list
          is a record — it does not undo a change.
        </p>
        <p className="mt-2">
          <Link
            href="/admin/settings"
            className="text-[12px] text-ink/55 underline-offset-2 hover:text-ink hover:underline"
          >
            Back to settings
          </Link>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="border border-ink/12 bg-milk px-4 py-6 text-[13px] text-ink/55">
          No audit entries yet.
        </p>
      ) : (
        <div className="overflow-x-auto border border-ink/12 bg-milk">
          <table className="w-full min-w-[40rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-ink/12 text-start text-[11px] uppercase tracking-[0.08em] text-ink/45">
                <th className="px-3 py-2 font-normal">When</th>
                <th className="px-3 py-2 font-normal">Who</th>
                <th className="px-3 py-2 font-normal">Action</th>
                <th className="px-3 py-2 font-normal">What</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const who =
                  row.actorName?.trim() ||
                  row.actorEmail ||
                  "System";
                const changed = [
                  summarise(row.before),
                  summarise(row.after),
                ]
                  .filter(Boolean)
                  .join(" → ");
                return (
                  <tr key={row.id} className="border-b border-ink/8 align-top">
                    <td className="px-3 py-2 font-data text-[12px] text-ink/70">
                      {row.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-ink">{who}</span>
                      {row.actorRole ? (
                        <span className="mt-0.5 block text-[11px] uppercase tracking-[0.06em] text-ink/45">
                          {row.actorRole}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-ink">{row.action}</td>
                    <td className="px-3 py-2 text-ink/70">
                      {row.entityType}
                      {row.entityId ? ` · ${row.entityId}` : ""}
                      {changed ? (
                        <span className="mt-0.5 block text-[11px] text-ink/45">
                          {changed}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
