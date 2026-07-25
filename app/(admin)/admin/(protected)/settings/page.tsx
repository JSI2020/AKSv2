import Link from "next/link";

import { EmptyState, Eyebrow } from "@/modules/ui";
import { auth } from "@/auth";
import { getPermissionsForUser } from "@/modules/auth";

export default async function AdminSettingsPage() {
  const session = await auth();
  const permissions = session?.user?.id
    ? await getPermissionsForUser(session.user.id)
    : new Set();
  const canStaff = permissions.has("staff.view");
  const canSettings = permissions.has("settings.view");

  return (
    <div>
      <Eyebrow>Settings</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Settings</h1>
      {canStaff || canSettings ? (
        <ul className="mt-6 flex flex-col gap-2 border border-indigo-lift p-4">
          {canStaff ? (
            <li>
              <Link
                href="/admin/settings/staff"
                className="font-sans text-[13px] text-greige underline-offset-2 hover:underline"
              >
                Staff — invite, roles, permissions, sessions
              </Link>
            </li>
          ) : null}
          {canSettings ? (
            <>
              <li>
                <Link
                  href="/admin/settings/sizing/categories"
                  className="font-sans text-[13px] text-greige underline-offset-2 hover:underline"
                >
                  Sizing — garment categories &amp; measurement keys
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/settings/sizing/blocks"
                  className="font-sans text-[13px] text-greige underline-offset-2 hover:underline"
                >
                  Sizing — size blocks (standard charts)
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/settings/sizing/fit-profiles"
                  className="font-sans text-[13px] text-greige underline-offset-2 hover:underline"
                >
                  Sizing — fit profiles (ease)
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/settings/sizing/archetypes"
                  className="font-sans text-[13px] text-greige underline-offset-2 hover:underline"
                >
                  Sizing — archetypes (house models)
                </Link>
              </li>
            </>
          ) : null}
        </ul>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="Settings"
            description="Rates, taxonomy, and house defaults will live here."
          />
        </div>
      )}
    </div>
  );
}
