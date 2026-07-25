import Image from "next/image";

import { Link } from "@/i18n/routing";
import { Money } from "@/modules/ui";

import { titleFromTagValue, type PublishedDesignCard } from "./types";

export function DesignCard({ design }: { design: PublishedDesignCard }) {
  const occasion = design.occasionLabels[0];

  return (
    <Link href={`/designs/${design.slug}`} className="group block">
      <div className="mb-3.5 overflow-hidden bg-greige-deep/50">
        {design.thumbnail?.url ? (
          <Image
            src={design.thumbnail.url}
            alt={design.thumbnail.altText || design.name}
            width={600}
            height={760}
            className="aspect-[3/4] h-[380px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex aspect-[3/4] h-[380px] w-full items-center justify-center bg-greige-deep text-[13px] text-ink/40">
            {design.name}
          </div>
        )}
      </div>
      {occasion ? (
        <p className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-madder">
          {titleFromTagValue(occasion)}
        </p>
      ) : (
        <p className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-madder">
          {design.garmentTypeName}
        </p>
      )}
      <p className="mb-1.5 font-display text-[19px]">{design.name}</p>
      <Money value={design.basePriceMinor} className="text-[14px] text-ink/60" />
    </Link>
  );
}
