import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { DESIGN_AWAITING_REVIEW_STATUSES } from "@/modules/admin/today/constants";
import { DesignsCatalog } from "@/modules/designs/designs-catalog";
import { listStudioCatalogGrouped } from "@/modules/designs/studio-catalog";

/** Designs hub — photo catalogue matching AKS_Design_Pipeline_Redesign_2. */
export default async function DesignsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ awaitingReview?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const awaitingReview =
    sp.awaitingReview === "true" || sp.awaitingReview === "1";
  const statusParam = (sp.status ?? "").trim();

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

  if (awaitingReview) {
    const review = new Set<string>(DESIGN_AWAITING_REVIEW_STATUSES);
    groups = groups
      .map((g) => ({
        ...g,
        designs: g.designs.filter((d) => review.has(d.status)),
      }))
      .filter((g) => g.designs.length > 0);
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
            {awaitingReview
              ? "Pipeline designs waiting on review or ready to publish."
              : statusParam
                ? `Filtered by status ${statusParam}.`
                : "Every look, by category — photos, colours, sizes."}
          </p>
          {awaitingReview ? (
            <p className="mt-2">
              <Link
                href="/admin/designs"
                className="text-[12px] text-ink/55 underline-offset-2 hover:text-ink hover:underline"
              >
                Show all designs
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/designs/publish-gaps"
            className="border border-ink/15 px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-ink/70 hover:border-ink hover:text-ink"
          >
            Published gaps
          </Link>
          <Link
            href="/admin/designs/new"
            className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.08em] text-milk transition-colors hover:bg-madder"
          >
            + New design
          </Link>
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          tone="on-greige"
          title={awaitingReview ? "Nothing awaiting review" : "No designs yet"}
          description={
            awaitingReview
              ? "No designs are in a review or ready-to-publish step right now."
              : "Create a design with photos, sizes, colours, and price — then publish when ready."
          }
          action={
            awaitingReview ? (
              <Link
                href="/admin/designs"
                className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.08em] text-milk"
              >
                Browse all designs
              </Link>
            ) : (
              <Link
                href="/admin/designs/new"
                className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.08em] text-milk"
              >
                + New design
              </Link>
            )
          }
        />
      ) : (
        <DesignsCatalog
          groups={groups}
          initialFilter={
            awaitingReview || statusParam.toUpperCase() === "REVIEW"
              ? "review"
              : statusParam.toUpperCase() === "PUBLISHED"
                ? "published"
                : statusParam.toUpperCase() === "DRAFT"
                  ? "draft"
                  : "all"
          }
          initialStatus={statusParam}
        />
      )}
    </div>
  );
}
