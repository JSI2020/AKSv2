"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useCan } from "@/modules/auth/use-can";
import type { PermissionKey } from "@aks/shared";
import { PERMISSION_MODULES } from "@aks/shared";

import { setPermissionOverrideAction } from "./actions";
import {
  cellStateFor,
  inheritedGranted,
  type PermissionCellState,
} from "./permission-helpers";

const STATE_CYCLE: Record<
  PermissionCellState,
  "INHERIT" | "GRANT" | "DENY"
> = {
  inherited: "GRANT",
  granted: "DENY",
  denied: "INHERIT",
};

function cellLabel(state: PermissionCellState, inheritedOn: boolean): string {
  if (state === "granted") return "Granted";
  if (state === "denied") return "Denied";
  return inheritedOn ? "Inherited · on" : "Inherited · off";
}

function cellClass(state: PermissionCellState, inheritedOn: boolean): string {
  if (state === "granted") return "border-zari bg-zari/20 text-greige";
  if (state === "denied") return "border-madder bg-madder/20 text-greige";
  return inheritedOn
    ? "border-chalk/30 bg-indigo-lift/30 text-chalk"
    : "border-indigo-lift text-chalk/60";
}

type MatrixStaff = {
  id: string;
  role: string;
  overrides: { key: PermissionKey; effect: "GRANT" | "DENY" }[];
  roleDefaults: PermissionKey[];
};

export function PermissionMatrix({ staff }: { staff: MatrixStaff }) {
  const canAssign = useCan("staff.assign_permissions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const locked = staff.role === "OWNER" || !canAssign;
  const defaults = new Set(staff.roleDefaults);

  return (
    <div className="overflow-x-auto border border-indigo-lift">
      <table className="w-full min-w-[40rem] border-collapse text-start text-[12px]">
        <thead>
          <tr className="border-b border-indigo-lift bg-indigo-lift/40">
            <th className="px-2 py-2 text-start font-sans font-medium uppercase tracking-[0.1em] text-chalk">
              Module
            </th>
            <th className="px-2 py-2 text-start font-sans font-medium uppercase tracking-[0.1em] text-chalk">
              Actions — cycle inherited → granted → denied
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
              <td className="px-2 py-2 font-sans text-greige">{mod}</td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {actions.map((action) => {
                    const key = `${mod}.${action}` as PermissionKey;
                    const state = cellStateFor(key, staff.overrides);
                    const inheritedOn = inheritedGranted(key, defaults);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={locked || pending}
                        title={key}
                        className={`border px-1.5 py-1 text-start ${cellClass(state, inheritedOn)} disabled:opacity-60`}
                        onClick={() => {
                          if (locked) return;
                          const next = STATE_CYCLE[state];
                          const fd = new FormData();
                          fd.set("userId", staff.id);
                          fd.set("key", key);
                          fd.set("effect", next);
                          startTransition(async () => {
                            await setPermissionOverrideAction(fd);
                            router.refresh();
                          });
                        }}
                      >
                        <span className="block font-data text-[10px] uppercase">
                          {action}
                        </span>
                        <span className="block text-[10px]">
                          {cellLabel(state, inheritedOn)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {locked ? (
        <p className="border-t border-indigo-lift px-2 py-2 text-[12px] text-chalk">
          {staff.role === "OWNER"
            ? "OWNER permissions cannot be overridden."
            : "You need staff.assign_permissions to edit this matrix."}
        </p>
      ) : null}
    </div>
  );
}
