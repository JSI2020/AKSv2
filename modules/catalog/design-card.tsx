import Image from "next/image";

import { Link } from "@/i18n/routing";
import { Money } from "@/modules/ui";
import {
  ImageSlotPlaceholder,
  type SilhouetteId,
} from "@/modules/shop/home/silhouette-svg";
import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

import {
  resolveDisplayPrice,
  resolvePercentOffBadge,
} from "./pricing";
import { titleFromTagValue, type PublishedDesignCard } from "./types";

const FALLBACK_HEXES = ["#F4EEE1", "#EAE1CF", "#DDD2BC", "#CDC0A8"];

const SILHOUETTE_CYCLE: SilhouetteId[] = [
  "kurta",
  "layered",
  "peshwaz",
  "farshi",
  "angrakha",
];

function houseLabel(design: PublishedDesignCard): string | null {
  for (const c of HOUSE_COLLECTIONS) {
    if (design.freeTags.some((t) => t.toUpperCase() === c.tag)) {
      return c.navLabel;
    }
  }
  if (design.freeTags.some((t) => t.toUpperCase() === "WHITE_COLLECTION")) {
    return "Signature";
  }
  return null;
}

function silhouetteFor(design: PublishedDesignCard): SilhouetteId {
  const idx = Math.abs(
    design.id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0),
  );
  return SILHOUETTE_CYCLE[idx % SILHOUETTE_CYCLE.length]!;
}

export function DesignCard({ design }: { design: PublishedDesignCard }) {
  const house = houseLabel(design);
  const silLine =
    design.silhouetteLabel ||
    (house
      ? `${house} · ${design.garmentTypeName}`
      : design.occasionLabels[0]
        ? `${titleFromTagValue(design.occasionLabels[0])} · ${design.garmentTypeName}`
        : design.garmentTypeName);

  const display = resolveDisplayPrice({
    basePriceMinor: design.basePriceMinor,
    compareAtPriceMinor: design.compareAtPriceMinor,
    compareAtStartsAt: design.compareAtStartsAt,
    compareAtEndsAt: design.compareAtEndsAt,
  });

  const percentOff = resolvePercentOffBadge({
    compareAtPercent: display.percentOff,
    automaticPercent: design.automaticPercentOff ?? null,
  });

  const hexes =
    design.colourwayHexes.length > 0
      ? design.colourwayHexes.slice(0, 4)
      : FALLBACK_HEXES;

  const hasHover = Boolean(design.hoverThumbnail?.url);
  const sil = silhouetteFor(design);

  return (
    <Link href={`/designs/${design.slug}`} className="card group">
      <div className="frame">
        {percentOff ? (
          <span className="sale-badge">−{percentOff}%</span>
        ) : null}
        {design.thumbnail?.url ? (
          <div className="imgslot figA" style={{ background: "var(--ivory)" }}>
            <Image
              src={design.thumbnail.url}
              alt={design.thumbnail.altText || design.name}
              fill
              sizes="(max-width:900px) 50vw, 25vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <ImageSlotPlaceholder
            silhouette={sil}
            className="figA"
            background="linear-gradient(160deg,#EAE1CF,#CDC0A8)"
            tag="Placeholder"
          />
        )}

        {hasHover && design.hoverThumbnail?.url ? (
          <div className="imgslot figB" style={{ background: "var(--bone)" }}>
            <Image
              src={design.hoverThumbnail.url}
              alt={design.hoverThumbnail.altText || design.name}
              fill
              sizes="(max-width:900px) 50vw, 25vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : design.thumbnail?.url ? (
          <div className="imgslot figB" style={{ background: "var(--bone)" }}>
            <Image
              src={design.thumbnail.url}
              alt=""
              fill
              sizes="(max-width:900px) 50vw, 25vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <ImageSlotPlaceholder
            silhouette={
              SILHOUETTE_CYCLE[
                (SILHOUETTE_CYCLE.indexOf(sil) + 1) % SILHOUETTE_CYCLE.length
              ]!
            }
            className="figB"
            background="linear-gradient(160deg,#DDD2BC,#A89A80)"
          />
        )}

        <div className="swatches">
          {hexes.map((hex) => (
            <span
              key={hex}
              className="sw"
              style={{ background: hex }}
              aria-hidden
            />
          ))}
        </div>
      </div>
      <div className="meta">
        <div className="n serif">{design.name}</div>
        {design.subtitle ? (
          <div className="sil" style={{ fontStyle: "normal", opacity: 0.85 }}>
            {design.subtitle}
          </div>
        ) : null}
        <div className="sil">{silLine}</div>
        <div className="p">
          <Money value={display.priceMinor} />
          {display.compareAtMinor ? (
            <span
              style={{
                textDecoration: "line-through",
                opacity: 0.55,
                marginInlineStart: "0.35rem",
              }}
            >
              <Money value={display.compareAtMinor} />
            </span>
          ) : null}
          <span>· made to order</span>
        </div>
      </div>
    </Link>
  );
}
