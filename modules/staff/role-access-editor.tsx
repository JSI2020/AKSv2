"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PERMISSION_MODULES, type PermissionKey } from "@aks/shared";
import { useCan } from "@/modules/auth/use-can";

import { setRolePermissionAction } from "./role-actions";

const MODULE_LABEL: Record<string, string> = {
  orders: "Orders",
  designs: "Designs",
  fabric: "Fabric",
  inventory: "Inventory",
  customers: "Customers",
  money: "Finance",
  insights: "Insights",
  settings: "Settings",
  staff: "Team & access",
  production: "Production",
  discounts: "Discounts",
  tryon: "Reflection",
  photoreal: "Photoreal",
  content: "Content",
};

const ROLE_BLURB: Record<string, string> = {
  ADMIN: "Full operational access, minus owner-only financial controls.",
  MANAGER: "Runs day-to-day orders, catalogue and production.",
  STAFF: "Handles orders and fulfilment; limited settings.",
  TAILOR: "Production floor — sees jobs and specs only.",
  ACCOUNTANT: "Finance, payments and reports.",
  READ_ONLY: "Can view, cannot change anything.",
};

export function RoleAccessEditor({
  roles,
  roleKeys,
}: {
  roles: string[];
  roleKeys: Record<string, PermissionKey[]>;
}) {
  const canEdit = useCan("staff.assign_permissions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(roles[0] ?? "MANAGER");
  const [error, setError] = useState<string | null>(null);
  // Local optimistic view of granted keys per role.
  const [granted, setGranted] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of roles) m[r] = new Set(roleKeys[r] ?? []);
    return m;
  });

  const current = granted[role] ?? new Set<string>();
  const grantedCount = current.size;
  const totalCount = useMemo(
    () =>
      Object.values(PERMISSION_MODULES).reduce(
        (n, actions) => n + actions.length,
        0,
      ),
    [],
  );

  function toggle(key: PermissionKey, on: boolean) {
    if (!canEdit) return;
    setError(null);
    setGranted((prev) => {
      const next = { ...prev };
      const set = new Set(next[role]);
      if (on) set.add(key);
      else set.delete(key);
      next[role] = set;
      return next;
    });
    const fd = new FormData();
    fd.set("role", role);
    fd.set("key", key);
    fd.set("on", String(on));
    startTransition(async () => {
      const res = await setRolePermissionAction(fd);
      if (!res.ok) {
        setError(res.error);
        // Roll back on failure.
        setGranted((prev) => {
          const next = { ...prev };
          const set = new Set(next[role]);
          if (on) set.delete(key);
          else set.add(key);
          next[role] = set;
          return next;
        });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {roles.map((r) => {
          const active = r === role;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={
                active
                  ? "border border-zari bg-zari/20 px-3 py-1.5 text-[12px] uppercase tracking-[0.08em] text-greige"
                  : "border border-indigo-lift px-3 py-1.5 text-[12px] uppercase tracking-[0.08em] text-chalk hover:border-chalk/40 hover:text-greige"
              }
            >
              {r}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-chalk">
          {ROLE_BLURB[role] ?? "Set what this role can do by default."}
        </p>
        <p className="font-data text-[11px] text-chalk">
          {grantedCount}/{totalCount} permissions
        </p>
      </div>

      {error ? (
        <p className="border border-madder/40 bg-madder/10 px-2 py-1.5 text-[12px] text-madder">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto border border-indigo-lift">
        <table className="w-full min-w-[44rem] border-collapse text-start text-[12px]">
          <thead>
            <tr className="border-b border-indigo-lift bg-indigo-lift/40">
              <th className="w-40 px-2.5 py-2 text-start font-sans font-medium uppercase tracking-[0.1em] text-chalk">
                Module
              </th>
              <th className="px-2.5 py-2 text-start font-sans font-medium uppercase tracking-[0.1em] text-chalk">
                Allowed actions — click to grant or revoke for this role
              </th>
            </tr>
          </thead>
          <tbody>
            {(
              Object.entries(PERMISSION_MODULES) as [
                keyof typeof PERMISSION_MODULES,
                readonly string[],
              ][]
            ).map(([mod, actions]) => (
              <tr key={mod} className="border-b border-indigo-lift/60 align-top">
                <td className="px-2.5 py-2.5 font-sans text-greige">
                  {MODULE_LABEL[mod] ?? mod}
                </td>
                <td className="px-2.5 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((action) => {
                      const key = `${mod}.${action}` as PermissionKey;
                      const on = current.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!canEdit || pending}
                          title={key}
                          onClick={() => toggle(key, !on)}
                          className={`border px-2 py-1 text-[11px] disabled:opacity-60 ${
                            on
                              ? "border-zari bg-zari/20 text-greige"
                              : "border-indigo-lift text-chalk/60 hover:border-chalk/40"
                          }`}
                        >
                          <span className="font-data uppercase">
                            {action.replace(/_/g, " ")}
                          </span>
                          <span className="ms-1">{on ? "✓" : "·"}</span>
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!canEdit ? (
        <p className="text-[12px] text-chalk">
          You need the “assign permissions” right to edit role access.
        </p>
      ) : (
        <p className="text-[12px] text-chalk">
          Changes apply immediately to everyone with this role — except explicit
          per-person overrides, which always win. OWNER always has everything.
        </p>
      )}
    </div>
  );
}
