import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getInventoryHubStats } from "@/modules/inventory";

export default async function InventoryHubPage() {
  let stats;
  try {
    stats = await getInventoryHubStats();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  const tiles = [
    {
      href: "/admin/inventory/designs",
      name: "Designs",
      stat: `${stats.designs.count} designs · ${stats.designs.low} sizes low`,
      low: stats.designs.low > 0,
    },
    {
      href: "/admin/inventory/fabrics",
      name: "Fabric",
      stat: `${stats.fabric.count} fabrics · ${stats.fabric.low} colours low`,
      low: stats.fabric.low > 0,
    },
    {
      href: "/admin/inventory/packing",
      name: "Packing",
      stat: `${stats.packing.count} items · ${stats.packing.low} low`,
      low: stats.packing.low > 0,
    },
    {
      href: "/admin/inventory/trims",
      name: "Trims",
      stat:
        stats.trims.low > 0
          ? `${stats.trims.count} trims · ${stats.trims.low} low`
          : `${stats.trims.count} trims · all healthy`,
      low: stats.trims.low > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-ink/55">
          Make · Inventory
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light leading-none text-ink">
          Stock
        </h1>
        <p className="mt-2 max-w-xl text-[13px] text-ink/55">
          Every stockable unit — photo-led, with a full history of what came in
          and what went out.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border border-ink/12 bg-milk px-6 py-6 transition-colors hover:border-ink"
          >
            <p className="font-display text-[1.6rem] font-light text-ink">
              {t.name}
            </p>
            <p
              className={`mt-2 font-data text-[12px] ${
                t.low ? "text-madder" : "text-ink/55"
              }`}
            >
              {t.stat}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
