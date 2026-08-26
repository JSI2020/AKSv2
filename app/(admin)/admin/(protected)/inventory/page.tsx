import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getInventoryHubStats } from "@/modules/inventory";
import { HealthFill } from "@/modules/admin/viz";

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
      healthy: Math.max(0, stats.designs.count - stats.designs.low),
      low: stats.designs.low,
      stat: `${stats.designs.count} designs · ${stats.designs.low} sizes low`,
    },
    {
      href: "/admin/inventory/fabrics",
      name: "Fabric",
      healthy: Math.max(0, stats.fabric.count - stats.fabric.low),
      low: stats.fabric.low,
      stat: `${stats.fabric.count} fabrics · ${stats.fabric.low} colours low`,
    },
    {
      href: "/admin/inventory/packing",
      name: "Packing",
      healthy: Math.max(0, stats.packing.count - stats.packing.low),
      low: stats.packing.low,
      stat: `${stats.packing.count} items · ${stats.packing.low} low`,
    },
    {
      href: "/admin/inventory/trims",
      name: "Trims",
      healthy: Math.max(0, stats.trims.count - stats.trims.low),
      low: stats.trims.low,
      stat:
        stats.trims.low > 0
          ? `${stats.trims.count} trims · ${stats.trims.low} low`
          : `${stats.trims.count} trims · all healthy`,
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
          and what went out. Madder on the gauge means something needs a reorder.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`border bg-milk px-6 py-6 transition-colors hover:border-ink ${
              t.low > 0
                ? "border-ink/12 border-s-[3px] border-s-madder"
                : "border-ink/12"
            }`}
          >
            <p className="font-display text-[1.6rem] font-light text-ink">
              {t.name}
            </p>
            <p
              className={`mt-2 font-data text-[12px] ${
                t.low > 0 ? "text-madder" : "text-ink/55"
              }`}
            >
              {t.stat}
            </p>
            <HealthFill
              healthy={t.healthy}
              low={t.low}
              label={
                t.low > 0
                  ? `${t.low} below reorder`
                  : "Stock levels look healthy"
              }
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
