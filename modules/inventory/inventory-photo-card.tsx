import Link from "next/link";

import { MetresTriadBar } from "@/modules/admin/viz";

export function InventoryPhotoCard({
  href,
  title,
  meta,
  stockLabel,
  stockValue,
  photoUrl,
  triad,
  low,
  lowTag,
  gradient,
  hexes,
  square,
}: {
  href: string;
  title: string;
  meta?: string;
  stockLabel?: string;
  stockValue?: string;
  photoUrl?: string | null;
  triad?: {
    onHand: number;
    reserved: number;
    available: number;
    reorderPoint?: number;
  };
  low?: boolean;
  lowTag?: string;
  gradient: string;
  hexes?: string[];
  square?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden border border-ink/12 bg-milk transition-colors hover:border-ink"
    >
      <div
        className={`relative overflow-hidden bg-greige ${square ? "aspect-square" : "aspect-[3/4]"}`}
        style={photoUrl ? undefined : { background: gradient }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-full object-cover" />
        ) : null}
        {low && lowTag ? (
          <span className="absolute top-2 inset-inline-start-2 bg-madder px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-milk">
            {lowTag}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-3.5 py-3">
        <p className="font-display text-[1.15rem] leading-tight text-ink">
          {title}
        </p>
        {meta ? (
          <p className="mt-1 text-[10.5px] uppercase tracking-[0.06em] text-ink/55">
            {meta}
          </p>
        ) : null}
        {hexes && hexes.length > 0 ? (
          <div className="mt-2 flex gap-1">
            {hexes.map((h) => (
              <span
                key={h}
                className="size-3.5 rounded-full border border-ink/15"
                style={{ backgroundColor: h }}
              />
            ))}
          </div>
        ) : null}
        {triad ? (
          <div className="mt-auto border-t border-ink/10 pt-2">
            <MetresTriadBar
              onHand={triad.onHand}
              reserved={triad.reserved}
              available={triad.available}
              reorderPoint={triad.reorderPoint ?? 0}
            />
          </div>
        ) : stockLabel && stockValue ? (
          <div className="mt-auto flex items-center justify-between border-t border-ink/10 pt-2 text-[12px]">
            <span className="text-ink/55">{stockLabel}</span>
            <span
              className={`font-data ${low ? "text-madder" : "text-ink"}`}
            >
              {stockValue}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
