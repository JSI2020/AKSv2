"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { FormEvent } from "react";

import type { FabricCatalogResult } from "@/modules/inventory";
import { Metres, Money } from "@/modules/ui";

type Drape = "LIGHT" | "MEDIUM" | "HEAVY";

const drapes: Array<{ label: string; value?: Drape }> = [
  { label: "All" },
  { label: "Light", value: "LIGHT" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Heavy", value: "HEAVY" },
];

function catalogHref(input: {
  q?: string;
  drape?: string;
  lowStock?: boolean;
}) {
  const params = new URLSearchParams();
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.drape) params.set("drape", input.drape);
  if (input.lowStock) params.set("lowStock", "true");
  const query = params.toString();
  return query ? `/admin/fabrics?${query}` : "/admin/fabrics";
}

export function FabricCatalog({
  result,
  q = "",
  drape,
  lowStock = false,
}: {
  result: FabricCatalogResult;
  q?: string;
  drape?: string;
  lowStock?: boolean;
}) {
  const router = useRouter();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    router.push(
      catalogHref({
        q: String(data.get("q") ?? ""),
        drape,
        lowStock,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form onSubmit={submitSearch} className="relative w-full max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-ink/45"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search fabric…"
            className="w-full border border-ink/15 bg-greige py-2 pe-3 ps-9 text-[13px] text-ink outline-none placeholder:text-ink/40 focus:border-ink"
          />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          {drapes.map((item) => {
            const selected = (item.value ?? "") === (drape ?? "");
            return (
              <Link
                key={item.label}
                href={catalogHref({ q, drape: item.value, lowStock })}
                className={`border px-3 py-1.5 text-[12px] ${
                  selected
                    ? "border-ink bg-ink text-greige"
                    : "border-ink/15 text-ink/60 hover:border-ink/50 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href={catalogHref({ q, drape, lowStock: !lowStock })}
            className={`border px-3 py-1.5 text-[12px] ${
              lowStock
                ? "border-madder bg-madder text-greige"
                : "border-madder text-madder hover:bg-madder/10"
            }`}
          >
            Low stock · {result.lowStockCount}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {result.items.map((fabric) => (
          <Link
            key={fabric.id}
            href={`/admin/fabrics/${fabric.id}`}
            className="group flex flex-col overflow-hidden border border-ink/12 bg-milk transition-colors hover:border-ink"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-greige">
              {fabric.swatchUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fabric.swatchUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
              <span className="absolute top-2.5 inset-inline-end-2.5 bg-milk/90 px-2 py-1 font-data text-[11px] text-ink">
                <Money value={fabric.costPerMeterMinor} />
                /m
              </span>
              {fabric.isLowStock ? (
                <span className="absolute bottom-2.5 inset-inline-start-2.5 bg-madder px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-milk">
                  Low stock
                </span>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col px-4 py-4">
              <h2 className="font-display text-[1.35rem] font-normal text-ink">
                {fabric.name}
              </h2>
              <p className="mt-0.5 text-[12px] text-ink/55">
                {fabric.composition}
              </p>
              <div className="mt-3">
                <span className="border border-ink/12 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.06em] text-ink/55">
                  {fabric.drapeClass === "LIGHT"
                    ? "Light"
                    : fabric.drapeClass === "HEAVY"
                      ? "Heavy"
                      : "Medium"}
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-ink/12 pt-3 text-[12px]">
                <span className="text-[10px] uppercase tracking-[0.08em] text-ink/55">
                  On hand
                </span>
                <Metres
                  value={fabric.metersOnHand}
                  className={fabric.isLowStock ? "text-madder" : "text-ink"}
                />
              </div>
            </div>
          </Link>
        ))}
        <Link
          href="/admin/fabrics/new"
          className="flex min-h-[16rem] flex-col items-center justify-center gap-2 border border-dashed border-ink/20 bg-milk text-ink/55 transition-colors hover:border-ink hover:text-ink"
        >
          <span className="text-[2rem] font-light">+</span>
          <span className="text-[11px] uppercase tracking-[0.12em]">
            Add fabric
          </span>
        </Link>
      </div>
    </div>
  );
}
