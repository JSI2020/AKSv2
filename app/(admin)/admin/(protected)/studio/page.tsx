import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { StudioCatalogGrid } from "@/modules/designs/studio-catalog-grid";
import { listStudioCatalogGrouped } from "@/modules/designs/studio-catalog";

/** Studio hub — photo catalogue by category (active / inactive). */
export default async function StudioHubPage() {
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
  const active = groups.reduce(
    (n, g) => n + g.designs.filter((d) => d.active).length,
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow className="text-ink/55">Studio</Eyebrow>
          <h1 className="mt-1 font-display text-3xl font-light text-ink">
            Design studio
          </h1>
          <p className="mt-1 max-w-xl text-[13.5px] text-ink/55">
            Every design by category — photos, colours, sizes, active or
            inactive. Add with your own imagery; AI generation lives under
            Photoreal.
          </p>
          {total > 0 ? (
            <p className="mt-2 font-sans text-[11px] uppercase tracking-[0.12em] text-ink/40">
              {total} designs ·{" "}
              <span className="text-zari">{active} active</span> ·{" "}
              {total - active} inactive
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/studio/ai"
            className="border border-ink/20 px-3 py-1.5 text-[13px] text-ink/55 hover:border-ink hover:text-ink"
          >
            AI brief
          </Link>
          <Link
            href="/admin/studio/new"
            className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo"
          >
            New design
          </Link>
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          title="No designs in studio"
          description="Create a design with photos, sizes, colours, and price — then publish when ready."
          action={
            <Link
              href="/admin/studio/new"
              className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo"
            >
              New design
            </Link>
          }
        />
      ) : (
        <StudioCatalogGrid groups={groups} />
      )}
    </div>
  );
}
