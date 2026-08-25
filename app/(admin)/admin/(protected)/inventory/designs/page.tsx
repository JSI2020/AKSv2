import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listRtwDesignCards } from "@/modules/inventory";
import { RtwDesignsInventoryView } from "@/modules/inventory/rtw-designs-inventory-view";

export default async function InventoryDesignsPage() {
  let cards;
  try {
    cards = await listRtwDesignCards();
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
          <Link
            href="/admin/inventory"
            className="underline-offset-2 hover:underline"
          >
            Inventory
          </Link>
          {" / Designs"}
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light text-ink">
          Ready-to-wear stock
        </h1>
        <p className="mt-2 text-[13px] text-ink/55">
          Grouped by house door — Essentials, Tailored, Occasion, Signature,
          Separates. Then colour, then size.
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="text-[13px] text-ink/55">
          No designs with colourways yet. Publish a design first.
        </p>
      ) : (
        <RtwDesignsInventoryView cards={cards} />
      )}
    </div>
  );
}
