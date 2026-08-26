import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Eyebrow } from "@/modules/ui";
import {
  EDITABLE_ROLES,
  getAllRolePermissionKeys,
  RoleAccessEditor,
} from "@/modules/staff";
import {
  getPermissionsForUser,
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

export default async function RolesSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const permissions = await getPermissionsForUser(session.user.id);
  if (!permissions.has("staff.view")) redirect("/admin");

  let roleKeys;
  try {
    roleKeys = await getAllRolePermissionKeys();
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
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/admin/settings"
          className="font-sans text-[12px] text-chalk hover:text-greige"
        >
          ← Settings
        </Link>
        <Eyebrow className="mt-2">Settings · Roles</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">Role access</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Decide what each role can do by default — view, create, edit or
          delete, per area, including finance. Anything not granted is hidden
          for that role. Per-person overrides on the Staff page always win, and
          OWNER always has full access.
        </p>
      </div>

      <RoleAccessEditor
        roles={[...EDITABLE_ROLES]}
        roleKeys={roleKeys}
      />
    </div>
  );
}
