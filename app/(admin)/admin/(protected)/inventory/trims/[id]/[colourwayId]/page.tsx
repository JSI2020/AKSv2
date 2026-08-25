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

export default async function TrimColourLedgerPage({
  params,
}: {
  params: Promise<{ id: string; colourwayId: string }>;
}) {
  const { id, colourwayId } = await params;
  let trim;
  try {
    trim = await getTrimDetail(id);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }
  if (!trim) notFound();
  const colour = trim.colours.find((c) => c.id === colourwayId);
  if (!colour) notFound();

  let detail;
  try {
    detail = await getTrimLedger(colour.stockId);
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
        {" / "}
        <Link href={`/admin/inventory/trims/${id}`} className="hover:underline">
          {trim.name}
        </Link>
      </p>
      <StockLedgerView detail={detail} />
    </div>
  );
}
