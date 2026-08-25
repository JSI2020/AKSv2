import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  getTrimDetail,
  getTrimLedger,
  StockLedgerView,
} from "@/modules/inventory";

export default async function InventoryTrimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail;
  try {
    detail = await getTrimDetail(id);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }
  if (!detail) notFound();

  if (!detail.hasColourVariants && detail.stockIdIfPlain) {
    let ledger;
    try {
      ledger = await getTrimLedger(detail.stockIdIfPlain);
    } catch (e) {
      if (
        e instanceof PermissionDeniedError ||
        e instanceof UnauthenticatedError
      ) {
        redirect("/admin");
      }
      throw e;
    }
    if (!ledger) notFound();
    return (
      <div className="flex flex-col gap-6">
        <p className="text-[12px] text-ink/55">
          <Link href="/admin/inventory" className="hover:underline">
            Inventory
          </Link>
          {" / "}
          <Link href="/admin/inventory/trims" className="hover:underline">
            Trims
          </Link>
        </p>
        <StockLedgerView detail={ledger} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[12px] text-ink/55">
          <Link href="/admin/inventory" className="hover:underline">
            Inventory
          </Link>
          {" / "}
          <Link href="/admin/inventory/trims" className="hover:underline">
            Trims
          </Link>
          {` / ${detail.name}`}
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light text-ink">
          {detail.name}
        </h1>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {detail.colours.map((c) => (
          <Link
            key={c.id}
            href={`/admin/inventory/trims/${id}/${c.id}`}
            className="overflow-hidden border border-ink/12 bg-milk transition-colors hover:border-ink"
          >
            <div
              className="aspect-square"
              style={{ background: c.gradient }}
            />
            <div className="px-3.5 py-3">
              <p className="font-display text-[1.15rem] text-ink">
                {c.colourName}
              </p>
              <p className="mt-1 font-data text-[12px] text-ink/55">
                {c.onHand} on hand
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
