import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  InventoryPhotoCard,
  listFabricInventoryCards,
} from "@/modules/inventory";

export default async function InventoryFabricsPage() {
  let cards;
  try {
    cards = await listFabricInventoryCards();
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
      <div>
        <p className="text-[12px] text-ink/55">
          <Link href="/admin/inventory" className="hover:underline">
            Inventory
          </Link>
          {" / Fabric"}
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light text-ink">
          Fabric stock
        </h1>
        <p className="mt-2 text-[13px] text-ink/55">By fabric, then colour.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <InventoryPhotoCard
            key={c.id}
            href={`/admin/inventory/fabrics/${c.id}`}
            title={c.name}
            meta={`PKR ${Math.round(c.rateMinor / 100).toLocaleString()}/m`}
            stockLabel="Total on hand"
            stockValue={`${(c.totalMeters / 100).toFixed(1)} m`}
            low={c.low}
            lowTag="Low colour"
            gradient={c.gradient}
            hexes={c.hexes}
            square
          />
        ))}
      </div>
    </div>
  );
}
