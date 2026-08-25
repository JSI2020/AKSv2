import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getPackingLedger, StockLedgerView } from "@/modules/inventory";

export default async function PackingLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail;
  try {
    detail = await getPackingLedger(id);
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
        <Link href="/admin/inventory/packing" className="hover:underline">
          Packing
        </Link>
      </p>
      <StockLedgerView detail={detail} />
    </div>
  );
}
