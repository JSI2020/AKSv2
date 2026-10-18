import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Eyebrow } from "@/modules/ui";
import { InviteStaffForm, listStaff } from "@/modules/staff";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

export default async function StaffSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const params = await searchParams;

  let staff;
  try {
    staff = await listStaff();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Staff</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">Staff</h1>
        <p className="mt-1 max-w-xl text-[13px] text-chalk">
          Invite teammates, assign roles, and manage permission overrides.
        </p>
      </div>

      <InviteStaffForm
        actorRole={session.user.role}
        defaultOpen={params.invite === "1"}
      />

      <div className="border border-indigo-lift">
        <div className="border-b border-indigo-lift px-3 py-2">
          <p className="font-sans text-[12px] uppercase tracking-[0.12em] text-chalk">
            Team
          </p>
        </div>
        <ul className="divide-y divide-indigo-lift">
          {staff.map((member) => (
            <li key={member.id}>
              <Link
                href={`/admin/settings/staff/${member.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-indigo-lift/40"
              >
                <div>
                  <p className="text-[13px] text-greige">
                    {member.name ?? member.email}
                  </p>
                  <p className="font-data text-[11px] text-chalk">
                    {member.email}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-sans text-[12px] text-greige">
                    {member.role}
                  </p>
                  <p className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
                    {member.status}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
