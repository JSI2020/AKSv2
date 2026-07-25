import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listFabricsBelowReorderPoint } from "@/modules/inventory";
import { listFabrics } from "@/modules/sizing/fabric-archetype-actions";
import { FabricListRow } from "@/modules/sizing/fabric-archetype-ui";

export default async function FabricsPage({
  searchParams,
}: {
  searchParams: Promise<{ lowStock?: string }>;
}) {
  const { lowStock } = await searchParams;
  const lowStockOnly = lowStock === "true";

  let fabrics;
  try {
    if (lowStockOnly) {
      const lowRows = await listFabricsBelowReorderPoint();
      const all = await listFabrics();
      const lowIds = new Set(lowRows.map((row) => row.id));
      fabrics = all.filter((f) => lowIds.has(f.id));
    } else {
      fabrics = await listFabrics();
    }
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
          <Eyebrow>Fabric</Eyebrow>
          <h1 className="mt-1 font-display text-3xl text-greige">Fabrics</h1>
          <p className="mt-1 max-w-xl text-[13px] text-chalk">
            {lowStockOnly
              ? "Fabrics below their reorder point — reorder before cutting stalls."
              : "Fit-affecting properties. Lots and suppliers come later — this table stays stable."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lowStockOnly ? (
            <Link
              href="/admin/fabrics"
              className="border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
            >
              Show all fabrics
            </Link>
          ) : null}
          <Link
            href="/admin/fabrics/new"
            className="border border-zari px-3 py-1.5 text-[13px] text-zari"
          >
            New fabric
          </Link>
        </div>
      </div>
      {fabrics.length === 0 ? (
        <EmptyState
          title={lowStockOnly ? "No low-stock fabrics" : "No fabrics"}
          description={
            lowStockOnly
              ? "Every fabric is above its reorder point."
              : "Seed or create a fabric."
          }
        />
      ) : (
        <ul className="divide-y divide-indigo-lift border border-indigo-lift">
          {fabrics.map((f) => (
            <li key={f.id}>
              <Link
                href={`/admin/fabrics/${f.id}`}
                className="block hover:bg-indigo-lift/40"
              >
                <FabricListRow fabric={f} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
