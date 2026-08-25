import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { InventoryPhotoCard, listTrimCards } from "@/modules/inventory";
import { AddTrimForm } from "@/modules/inventory/add-packing-trim-forms";

export default async function InventoryTrimsPage() {
  let cards;
  try {
    cards = await listTrimCards();
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
          {" / Trims"}
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light text-ink">
          Trims
        </h1>
        <p className="mt-2 text-[13px] text-ink/55">
          Add buttons, zips, lining here — with colour variants when needed.
        </p>
      </div>

      <AddTrimForm />

      {cards.length === 0 ? (
        <p className="text-[13px] text-ink/55">
          No trims yet — use Add trim above.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <InventoryPhotoCard
              key={c.id}
              href={`/admin/inventory/trims/${c.id}`}
              title={c.name}
              meta={
                c.hasColourVariants
                  ? `${c.colourCount} colour${c.colourCount === 1 ? "" : "s"}`
                  : c.kind
              }
              stockLabel="Total"
              stockValue={`${c.total} pcs`}
              gradient={c.gradient}
              hexes={c.hexes}
              square
            />
          ))}
        </div>
      )}
    </div>
  );
}
