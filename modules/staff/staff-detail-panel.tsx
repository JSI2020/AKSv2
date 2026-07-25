"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useCan } from "@/modules/auth/use-can";
import { ConfirmDialog } from "@/modules/ui";

import { INVITABLE_ROLES } from "./roles";
import {
  deactivateStaffAction,
  revokeStaffSessionAction,
  updateStaffRoleAction,
} from "./actions";
import type { StaffDetail } from "./queries";
import { PermissionMatrix } from "./permission-matrix";

export function StaffDetailPanel({
  staff,
  actorRole,
  actorId,
}: {
  staff: StaffDetail;
  actorRole: string;
  actorId: string;
}) {
  const canEdit = useCan("staff.edit");
  const canDeactivate = useCan("staff.deactivate");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const roles =
    actorRole === "OWNER"
      ? (["OWNER", ...INVITABLE_ROLES] as const)
      : INVITABLE_ROLES.filter((r) => r !== "ADMIN");

  return (
    <div className="flex flex-col gap-6">
      <section className="border border-indigo-lift p-4">
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Profile
        </p>
        <h2 className="mt-1 font-display text-2xl text-greige">
          {staff.name ?? staff.email}
        </h2>
        <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-chalk">Email</dt>
            <dd className="text-greige">{staff.email}</dd>
          </div>
          <div>
            <dt className="text-chalk">Status</dt>
            <dd className="text-greige">{staff.status}</dd>
          </div>
          <div>
            <dt className="text-chalk">Role</dt>
            <dd className="text-greige">{staff.role}</dd>
          </div>
          <div>
            <dt className="text-chalk">Last login</dt>
            <dd className="font-data text-greige">
              {staff.lastLoginAt
                ? new Date(staff.lastLoginAt).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>

        {canEdit && staff.role !== "OWNER" ? (
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              startTransition(async () => {
                const result = await updateStaffRoleAction(fd);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="userId" value={staff.id} />
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.1em] text-chalk">
                Assign role
              </span>
              <select
                name="role"
                defaultValue={staff.role}
                className="border border-indigo-lift bg-indigo-lift/40 px-2 py-1.5 text-[13px] text-greige outline-none"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="submit"
              disabled={pending}
              size="sm"
              className="bg-zari text-ink hover:bg-zari/90"
            >
              Save role
            </Button>
          </form>
        ) : null}

        {canDeactivate &&
        staff.role !== "OWNER" &&
        staff.id !== actorId &&
        staff.status !== "DISABLED" ? (
          <div className="mt-4">
            <ConfirmDialog
              title="Deactivate this account?"
              description="They will lose access immediately and all sessions will be revoked."
              confirmLabel="Deactivate"
              trigger={
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="bg-madder text-greige hover:bg-madder/90"
                >
                  Deactivate
                </Button>
              }
              onConfirm={async () => {
                const fd = new FormData();
                fd.set("userId", staff.id);
                const result = await deactivateStaffAction(fd);
                if (!result.ok) {
                  setError(result.error);
                  throw new Error(result.error);
                }
                router.refresh();
              }}
            />
          </div>
        ) : null}

        {error ? <p className="mt-2 text-[13px] text-madder">{error}</p> : null}
      </section>

      <section>
        <p className="mb-2 font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Permission matrix
        </p>
        <PermissionMatrix staff={staff} />
      </section>

      <section className="border border-indigo-lift p-4">
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Sessions
        </p>
        {staff.sessions.length === 0 ? (
          <p className="mt-2 text-[13px] text-chalk">No active sessions.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {staff.sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-indigo-lift/60 px-2 py-2 text-[13px]"
              >
                <div>
                  <p className="text-greige">{s.device ?? "Unknown device"}</p>
                  <p className="font-data text-[11px] text-chalk">
                    {s.ip ?? "—"} · last seen{" "}
                    {s.lastSeenAt
                      ? new Date(s.lastSeenAt).toLocaleString()
                      : "—"}
                  </p>
                </div>
                {canEdit ? (
                  <ConfirmDialog
                    title="Revoke this session?"
                    description="The device will need to sign in again."
                    confirmLabel="Revoke"
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-madder/50 bg-transparent text-madder hover:bg-madder/10"
                      >
                        Revoke
                      </Button>
                    }
                    onConfirm={async () => {
                      const fd = new FormData();
                      fd.set("userId", staff.id);
                      fd.set("sessionId", s.id);
                      const result = await revokeStaffSessionAction(fd);
                      if (!result.ok) {
                        setError(result.error);
                        throw new Error(result.error);
                      }
                      router.refresh();
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
