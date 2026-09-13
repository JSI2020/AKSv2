import Link from "next/link";

import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { CollectionsAdmin } from "@/modules/content/admin/collections-admin";
import { listHouseCollectionsAdmin } from "@/modules/content/house-collection-actions";

export default async function HouseCollectionsPage() {
  await requirePermission("content.view");
  const rows = await listHouseCollectionsAdmin();

  return (
    <div>
      <Link
        href="/admin/content"
        className="font-sans text-[12px] text-ink/55 hover:text-zari"
      >
        ← Content & Settings
      </Link>
      <Eyebrow className="mt-4 text-ink/55">Content · House doors</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-light text-ink">
        Collections
      </h1>
      <p className="mt-2 max-w-2xl text-[13px] text-ink/55">
        House doors group designs on the storefront — Essentials, Tailored, and
        the rest. Each door maps to a FREE tag on designs, a collection URL, and
        homepage gates. Deleting a door moves tagged designs to your chosen
        target.
      </p>
      <CollectionsAdmin initial={rows} />
    </div>
  );
}
