import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getRtwDesignDetail } from "@/modules/inventory";
import { RtwDesignStockView } from "@/modules/inventory/rtw-design-stock-view";

export default async function InventoryDesignDetailPage({
  params,
}: {
  params: Promise<{ designId: string }>;
}) {
  const { designId } = await params;
  let detail;
  try {
    detail = await getRtwDesignDetail(designId);
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
      <div>
        <p className="text-[12px] text-ink/55">
          <Link href="/admin/inventory" className="hover:underline">
            Inventory
          </Link>
          {" / "}
          <Link href="/admin/inventory/designs" className="hover:underline">
            Designs
          </Link>
          {` / ${detail.name}`}
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light text-ink">
          {detail.name}
        </h1>
        <p className="mt-2 text-[13px] text-ink/55">
          Pick a colour, then a size, to see its stock history.
        </p>
        <p className="mt-3">
          <Link
            href={`/admin/designs/${designId}`}
            className="text-[13px] text-ink hover:text-zari"
          >
            Open design
          </Link>
        </p>
      </div>
      <RtwDesignStockView detail={detail} />
    </div>
  );
}
