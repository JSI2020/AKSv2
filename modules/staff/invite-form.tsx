"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useCan } from "@/modules/auth/use-can";

import { inviteStaffAction } from "./actions";
import { INVITABLE_ROLES } from "./roles";

export function InviteStaffForm({
  actorRole,
  defaultOpen = false,
}: {
  actorRole: string;
  defaultOpen?: boolean;
}) {
  const canCreate = useCan("staff.create");
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canCreate) return null;

  const roles =
    actorRole === "OWNER"
      ? INVITABLE_ROLES
      : INVITABLE_ROLES.filter((r) => r !== "ADMIN");

  return (
    <div className="border border-indigo-lift">
      <div className="flex items-center justify-between gap-2 border-b border-indigo-lift px-3 py-2">
        <p className="font-sans text-[12px] uppercase tracking-[0.12em] text-chalk">
          Invite staff
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-chalk/40 bg-transparent text-greige hover:bg-indigo-lift"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Invite"}
        </Button>
      </div>
      {open ? (
        <form
          className="flex flex-col gap-3 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              const result = await inviteStaffAction(fd);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.push(`/admin/settings/staff/${result.userId}`);
              router.refresh();
            });
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.1em] text-chalk">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              className="border border-indigo-lift bg-indigo-lift/40 px-2 py-1.5 text-[13px] text-greige outline-none focus:border-chalk"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.1em] text-chalk">
              Name
            </span>
            <input
              name="name"
              type="text"
              className="border border-indigo-lift bg-indigo-lift/40 px-2 py-1.5 text-[13px] text-greige outline-none focus:border-chalk"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.1em] text-chalk">
              Role
            </span>
            <select
              name="role"
              defaultValue="MANAGER"
              className="border border-indigo-lift bg-indigo-lift/40 px-2 py-1.5 text-[13px] text-greige outline-none focus:border-chalk"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-[13px] text-madder">{error}</p> : null}
          <Button
            type="submit"
            disabled={pending}
            className="self-start bg-zari text-ink hover:bg-zari/90"
          >
            {pending ? "Sending…" : "Send invite"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
