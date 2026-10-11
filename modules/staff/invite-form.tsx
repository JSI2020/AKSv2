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
  const [created, setCreated] = useState<{
    userId: string;
    email: string;
    tempPassword: string;
    loginUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
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
          Add staff member
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-chalk/40 bg-transparent text-greige hover:bg-indigo-lift"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Add"}
        </Button>
      </div>
      {created ? (
        <CreatedPanel
          created={created}
          copied={copied}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(
                shareText(created.email, created.tempPassword, created.loginUrl),
              );
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          onDone={() => {
            const id = created.userId;
            setCreated(null);
            router.push(`/admin/settings/staff/${id}`);
          }}
        />
      ) : null}
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
              setCopied(false);
              setCreated({
                userId: result.userId,
                email: result.email,
                tempPassword: result.tempPassword,
                loginUrl: result.loginUrl,
              });
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
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function shareText(email: string, tempPassword: string, loginUrl: string) {
  return `AKS admin sign-in
${loginUrl}
Email: ${email}
One-time password: ${tempPassword}
You'll choose your own password straight after. It expires in 7 days.`;
}

/** Shown once, right after creating the account — the password is not stored readable. */
function CreatedPanel({
  created,
  copied,
  onCopy,
  onDone,
}: {
  created: { email: string; tempPassword: string; loginUrl: string };
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}) {
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    shareText(created.email, created.tempPassword, created.loginUrl),
  )}`;
  return (
    <div className="flex flex-col gap-3 border-b border-indigo-lift p-3" role="status">
      <p className="text-[13px] text-greige">
        Account created for <strong>{created.email}</strong>. We&apos;ve emailed
        them this one-time password too.
      </p>
      <div className="flex items-center justify-between gap-3 border border-zari/60 bg-zari/10 px-3 py-2.5">
        <span className="font-data text-[18px] tracking-[0.08em] text-greige">
          {created.tempPassword}
        </span>
        <span className="text-[11px] text-chalk">works once · 7 days</span>
      </div>
      <p className="text-[12px] text-chalk">
        Copy it now — it won&apos;t be shown again. On first sign-in they choose
        their own password.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-zari text-ink hover:bg-zari/90"
          onClick={onCopy}
        >
          {copied ? "Copied ✓" : "Copy sign-in details"}
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-chalk/40 px-3 py-1.5 text-[12px] text-greige hover:bg-indigo-lift"
        >
          Send on WhatsApp
        </a>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-chalk/40 bg-transparent text-greige hover:bg-indigo-lift"
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
