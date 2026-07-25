import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, Eyebrow, Money } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listDesigns } from "@/modules/designs";

export default async function DesignsAdminPage() {
  let designs;
  try {
    designs = await listDesigns();
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Designs</Eyebrow>
          <h1 className="mt-1 font-display text-3xl text-greige">Catalogue</h1>
          <p className="mt-1 max-w-xl text-[13px] text-chalk">
            Enter designs by hand — no AI. Colourways, renders, sizing, pricing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/studio/new"
            className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo"
          >
            Studio brief
          </Link>
          <Link
            href="/admin/designs/new"
            className="border border-zari px-3 py-1.5 text-[13px] text-zari"
          >
            New design
          </Link>
        </div>
      </div>

      {designs.length === 0 ? (
        <EmptyState
          title="No designs yet"
          description="Create a draft, add colourways and angles, then publish."
        />
      ) : (
        <ul className="divide-y divide-indigo-lift border border-indigo-lift">
          {designs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/admin/designs/${d.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-indigo-lift/40"
              >
                <div>
                  <p className="text-[13px] text-greige">{d.name}</p>
                  <p className="font-data text-[11px] text-chalk">
                    {d.categoryKey} · {d.status}
                    {d.featured ? " · featured" : ""}
                  </p>
                </div>
                <Money value={d.basePriceMinor} className="text-[12px] text-chalk" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
