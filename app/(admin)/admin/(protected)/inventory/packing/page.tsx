import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  InventoryPhotoCard,
  listPackingCards,
} from "@/modules/inventory";
import { AddPackingMaterialForm } from "@/modules/inventory/add-packing-trim-forms";

export default async function InventoryPackingPage() {
  let cards;
  try {
    cards = await listPackingCards();
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
          {" / Packing"}
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light text-ink">
          Packing materials
        </h1>
        <p className="mt-2 max-w-xl text-[13px] text-ink/55">
          Add boxes, tissue, bags here — Designs and Fabric stock come from
          Create. Record movements on each item for received stock or
          corrections.
        </p>
      </div>

      <AddPackingMaterialForm />

      {cards.length === 0 ? (
        <p className="text-[13px] text-ink/55">
          No packing materials yet — use Add packing item above.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <InventoryPhotoCard
              key={c.id}
              href={`/admin/inventory/packing/${c.id}`}
              title={c.name}
              stockLabel="On hand"
              stockValue={`${c.onHand} pcs`}
              low={c.low}
              lowTag="Reorder"
              gradient="linear-gradient(155deg,#EAE1CF,#CDC0A8)"
              square
            />
          ))}
        </div>
      )}
    </div>
  );
}
