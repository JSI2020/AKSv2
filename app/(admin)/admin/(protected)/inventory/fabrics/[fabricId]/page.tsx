import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listFabricColourCards } from "@/modules/inventory";

export default async function InventoryFabricColoursPage({
  params,
}: {
  params: Promise<{ fabricId: string }>;
}) {
  const { fabricId } = await params;
  let data;
  try {
    data = await listFabricColourCards(fabricId);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[12px] text-ink/55">
          <Link href="/admin/inventory" className="hover:underline">
            Inventory
          </Link>
          {" / "}
          <Link href="/admin/inventory/fabrics" className="hover:underline">
            Fabric
          </Link>
          {` / ${data.fabricName}`}
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light text-ink">
          {data.fabricName}
        </h1>
        <p className="mt-2 text-[13px] text-ink/55">
          Each colour tracked separately — dye lots vary slightly between
          batches.
        </p>
        <p className="mt-3">
          <Link
            href={`/admin/fabrics/${fabricId}`}
            className="text-[13px] text-ink hover:text-zari"
          >
            Open fabric
          </Link>
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {data.colours.map((c) => (
          <Link
            key={c.id}
            href={`/admin/inventory/fabrics/${fabricId}/${c.id}`}
            className="overflow-hidden border border-ink/12 bg-milk transition-colors hover:border-ink"
          >
            <div
              className="relative aspect-square"
              style={{ background: c.gradient }}
            >
              {c.low ? (
                <span className="absolute top-2 inset-inline-start-2 bg-madder px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-milk">
                  Reorder
                </span>
              ) : null}
            </div>
            <div className="px-3.5 py-3">
              <p className="font-display text-[1.15rem] text-ink">
                {c.colourName}
              </p>
              <p
                className={`mt-1 font-data text-[12px] ${
                  c.low ? "text-madder" : "text-ink/55"
                }`}
              >
                {(c.onHand / 100).toFixed(1)} m on hand
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
