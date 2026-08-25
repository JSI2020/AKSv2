import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listPublishedDesignOptions } from "@/modules/content/design-refs";
import { DiscountsDashboard, listDiscounts } from "@/modules/discounts";

export default async function AdminDiscountsPage() {
  let rows;
  let publishedDesigns: Awaited<ReturnType<typeof listPublishedDesignOptions>> =
    [];
  try {
    [rows, publishedDesigns] = await Promise.all([
      listDiscounts(),
      listPublishedDesignOptions(),
    ]);
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
    <div>
      <Link
        href="/admin/content"
        className="font-sans text-[12px] text-ink/55 hover:text-zari"
      >
        ← Content & Settings
      </Link>
      <Eyebrow className="mt-4 text-ink/55">Sell · Discounts</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-light text-ink">
        Discounts
      </h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-ink/55">
        By code, or automatic — on the whole order, a category, or one specific
        style.
      </p>
      <div className="mt-6">
        <DiscountsDashboard
          rows={rows}
          publishedDesigns={publishedDesigns.map((d) => ({
            id: d.id,
            name: d.name,
          }))}
        />
      </div>
    </div>
  );
}
