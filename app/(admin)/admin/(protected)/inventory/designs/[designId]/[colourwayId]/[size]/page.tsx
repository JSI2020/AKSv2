import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getRtwLedger, StockLedgerView } from "@/modules/inventory";

export default async function RtwSizeLedgerPage({
  params,
}: {
  params: Promise<{ designId: string; colourwayId: string; size: string }>;
}) {
  const { designId, colourwayId, size } = await params;
  const sizeLabel = decodeURIComponent(size);
  let detail;
  try {
    detail = await getRtwLedger(designId, colourwayId, sizeLabel);
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
        <Link href="/admin/inventory/designs" className="hover:underline">
          Designs
        </Link>
        {" / "}
        <Link
          href={`/admin/inventory/designs/${designId}`}
          className="hover:underline"
        >
          Design
        </Link>
        {` / ${sizeLabel}`}
      </p>
      <p>
        <Link
          href={`/admin/designs/${designId}`}
          className="text-[13px] text-ink hover:text-zari"
        >
          Open design
        </Link>
      </p>
      <StockLedgerView detail={detail} />
    </div>
  );
}
