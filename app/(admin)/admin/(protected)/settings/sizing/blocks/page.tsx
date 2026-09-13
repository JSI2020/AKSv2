import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listStandardSizeCharts } from "@/modules/sizing/block-actions";
import { ensureDefaultSizeBlocksForAllCategories } from "@/modules/sizing/ensure-default-blocks";

export default async function SizeBlocksPage() {
  let charts;
  try {
    await ensureDefaultSizeBlocksForAllCategories();
    charts = await listStandardSizeCharts();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  const ready = charts.filter((c) => c.hasChart).length;
  const missing = charts.filter((c) => !c.hasChart);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          Standard size charts
        </h1>
        <p className="mt-1 max-w-xl text-[13px] text-chalk">
          One house chart per garment category. Unpinned cells are computed from
          base + grade — never stored.
        </p>
        <p className="mt-2 font-data text-[11px] text-chalk">
          {ready} of {charts.length} categories have a default chart
        </p>
      </div>

      {missing.length > 0 && (
        <p className="border border-madder/40 px-3 py-2 text-[13px] text-madder">
          {missing.length} categor{missing.length === 1 ? "y is" : "ies are"}{" "}
          missing a chart — refresh this page after import, or run{" "}
          <code className="font-data text-[12px]">npm run db:import:sizing-research</code>
          .
        </p>
      )}

      <div className="border border-indigo-lift">
        <div className="border-b border-indigo-lift px-3 py-2">
          <p className="font-sans text-[12px] uppercase tracking-[0.12em] text-chalk">
            By category · {charts.length}
          </p>
        </div>
        <ul className="divide-y divide-indigo-lift">
          {charts.map((c) => (
            <li key={c.categoryId}>
              {c.blockId ? (
                <Link
                  href={`/admin/settings/sizing/blocks/${c.blockId}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-indigo-lift/40"
                >
                  <div>
                    <p className="text-[13px] text-greige">
                      {c.categoryName}
                      <span className="ms-2 font-data text-[11px] text-chalk">
                        {c.categoryKey}
                      </span>
                    </p>
                    <p className="font-data text-[11px] text-chalk">
                      {c.blockName} · base {c.baseSizeLabel} ·{" "}
                      {c.sizeLabels.join(" ")}
                      {c.rowCount > 0 ? ` · ${c.rowCount} keys` : ""}
                    </p>
                  </div>
                  <p className="font-sans text-[11px] uppercase tracking-[0.08em] text-zari">
                    Edit chart
                  </p>
                </Link>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] text-greige">{c.categoryName}</p>
                    <p className="font-data text-[11px] text-chalk">
                      {c.categoryKey} · no default chart
                    </p>
                  </div>
                  <Link
                    href={`/admin/settings/sizing/categories/${c.categoryId}`}
                    className="text-[11px] uppercase tracking-[0.08em] text-chalk hover:text-greige"
                  >
                    Category
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[12px] text-chalk">
        <Link href="/admin/settings/sizing/categories" className="text-zari hover:underline">
          Garment categories
        </Link>{" "}
        define measurement keys; this list is the matching standard chart for
        each one.
      </p>
    </div>
  );
}
