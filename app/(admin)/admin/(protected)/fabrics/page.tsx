import Link from "next/link";
import { redirect } from "next/navigation";

import { PermissionDeniedError, UnauthenticatedError } from "@/modules/auth";
import { listFabricsCatalog } from "@/modules/inventory";
import { FabricCatalog } from "@/modules/fabrics/admin/fabric-catalog";

export default async function FabricsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; drape?: string; lowStock?: string }>;
}) {
  const { q, drape, lowStock } = await searchParams;
  const lowStockOnly = lowStock === "true";

  const drapeClass =
    drape === "LIGHT" || drape === "MEDIUM" || drape === "HEAVY"
      ? drape
      : undefined;
  let result;
  try {
    result = await listFabricsCatalog({ q, drapeClass, lowStockOnly });
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
      <p className="text-[12px] text-ink/55">
        Admin / <span className="text-ink">Fabric</span>
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-ink/55">
            Create · Fabric
          </p>
          <h1 className="mt-2 font-display text-[2.4rem] font-light leading-none text-ink">
            Fabric
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-ink/55">
            The cloth you make from. Tap a fabric for detail, stock, and lots.
          </p>
        </div>
        <Link
          href="/admin/fabrics/new"
          className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.1em] text-milk transition-colors hover:bg-madder"
        >
          + New fabric
        </Link>
      </div>
      <FabricCatalog
        result={result}
        q={q}
        drape={drapeClass}
        lowStock={lowStockOnly}
      />
    </div>
  );
}
