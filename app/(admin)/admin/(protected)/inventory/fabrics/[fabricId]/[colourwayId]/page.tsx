import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getFabricColourLedger, StockLedgerView } from "@/modules/inventory";

export default async function FabricColourLedgerPage({
  params,
}: {
  params: Promise<{ fabricId: string; colourwayId: string }>;
}) {
  const { fabricId, colourwayId } = await params;
  let detail;
  try {
    detail = await getFabricColourLedger(fabricId, colourwayId);
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
        <Link href="/admin/inventory/fabrics" className="hover:underline">
          Fabric
        </Link>
        {" / "}
        <Link
          href={`/admin/inventory/fabrics/${fabricId}`}
          className="hover:underline"
        >
          Colours
        </Link>
      </p>
      <p>
        <Link
          href={`/admin/fabrics/${fabricId}`}
          className="text-[13px] text-ink hover:text-zari"
        >
          Open fabric
        </Link>
      </p>
      <StockLedgerView detail={detail} />
    </div>
  );
}
