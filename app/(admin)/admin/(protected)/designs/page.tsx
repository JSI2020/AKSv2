import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { DesignsCatalog } from "@/modules/designs/designs-catalog";
import { listStudioCatalogGrouped } from "@/modules/designs/studio-catalog";

/** Designs hub — photo catalogue matching AKS_Design_Pipeline_Redesign_2. */
export default async function DesignsAdminPage() {
  let groups;
  try {
    groups = await listStudioCatalogGrouped();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  const total = groups.reduce((n, g) => n + g.designs.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-ink/55">
            Create · Designs
          </p>
          <h1 className="mt-2 font-display text-[2.2rem] font-light leading-none text-ink">
            Designs
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-ink/55">
            Every look, by category — photos, colours, sizes.
            {total > 0 ? ` ${total} designs shown.` : ""}
          </p>
        </div>
        <Link
          href="/admin/designs/new"
          className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.08em] text-milk transition-colors hover:bg-madder"
        >
          + New design
        </Link>
      </div>

      {total === 0 ? (
        <EmptyState
          title="No designs yet"
          description="Create a design with photos, sizes, colours, and price — then publish when ready."
          action={
            <Link
              href="/admin/designs/new"
              className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.08em] text-milk"
            >
              + New design
            </Link>
          }
        />
      ) : (
        <DesignsCatalog groups={groups} />
      )}
    </div>
  );
}
