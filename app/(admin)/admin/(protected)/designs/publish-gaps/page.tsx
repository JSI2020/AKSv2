import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, Money } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listPublishedCatalogueGaps } from "@/modules/designs/publish-gaps";

/** Read-only list. Does not unpublish anything. */
export default async function PublishedCatalogueGapsPage() {
  let gaps;
  try {
    gaps = await listPublishedCatalogueGaps();
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
        <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-ink/55">
          Create · Designs
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light leading-none text-ink">
          Published gaps
        </h1>
        <p className="mt-2 max-w-xl text-[13px] text-ink/55">
          Designs already on the shop that have no photo, or a cost of PKR 0.
          Nothing here is taken off the shop — open a design and fix it when
          you are ready.
        </p>
        <p className="mt-2">
          <Link
            href="/admin/designs"
            className="text-[12px] text-ink/55 underline-offset-2 hover:text-ink hover:underline"
          >
            Back to designs
          </Link>
        </p>
      </div>

      {gaps.length === 0 ? (
        <EmptyState
          tone="on-greige"
          title="No photo or cost gaps"
          description="Every published design has a photo and a cost above zero."
        />
      ) : (
        <ul className="flex flex-col border border-ink/12 bg-milk">
          {gaps.map((gap) => (
            <li
              key={gap.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-4 py-3 last:border-b-0"
            >
              <div>
                <Link
                  href={`/admin/designs/${gap.id}`}
                  className="font-display text-[1.15rem] text-ink hover:underline"
                >
                  {gap.name}
                </Link>
                <p className="mt-1 text-[12px] text-ink/55">
                  {gap.missingPhoto ? "No photo" : null}
                  {gap.missingPhoto && gap.zeroCost ? " · " : null}
                  {gap.zeroCost ? "Cost is PKR 0" : null}
                  {" · "}
                  Price <Money value={gap.priceMinor} />
                  {" · "}
                  Cost <Money value={gap.costMinor} />
                </p>
              </div>
              <Link
                href={`/designs/${gap.slug}`}
                className="text-[12px] text-ink/55 underline-offset-2 hover:text-ink hover:underline"
              >
                View on shop
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
