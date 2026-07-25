import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { Eyebrow } from "@/modules/ui";
import { getStaffDetail, StaffDetailPanel } from "@/modules/staff";
import { getStaffRelated, StaffRelatedPanels } from "@/modules/insights";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

export default async function StaffMemberPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const { userId } = await params;

  let staff;
  let related;
  try {
    [staff, related] = await Promise.all([
      getStaffDetail(userId),
      getStaffRelated(userId),
    ]);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!staff) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/admin/settings/staff"
          className="font-sans text-[12px] text-chalk hover:text-greige"
        >
          ← Staff
        </Link>
        <Eyebrow className="mt-2">Settings · Staff</Eyebrow>
      </div>
      <StaffDetailPanel
        staff={staff}
        actorRole={session.user.role}
        actorId={session.user.id}
      />
      <StaffRelatedPanels data={related} />
    </div>
  );
}
