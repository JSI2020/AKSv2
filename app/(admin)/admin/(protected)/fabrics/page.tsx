import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listFabrics } from "@/modules/sizing/fabric-archetype-actions";
import { FabricListRow } from "@/modules/sizing/fabric-archetype-ui";

export default async function FabricsPage() {
  let fabrics;
  try {
    fabrics = await listFabrics();
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
            Fit-affecting properties. Lots and suppliers come later — this table
            stays stable.
          </p>
        </div>
        <Link
          href="/admin/fabrics/new"
          className="border border-zari px-3 py-1.5 text-[13px] text-zari"
        >
          New fabric
        </Link>
      </div>
      {fabrics.length === 0 ? (
        <EmptyState title="No fabrics" description="Seed or create a fabric." />
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
