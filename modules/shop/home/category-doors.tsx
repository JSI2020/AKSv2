import { Link } from "@/i18n/routing";
import type { CategoryTilePublic } from "@/modules/content/types";
import type { HouseCollectionPublic } from "@/modules/catalog/house-collections-queries";
import { AksBrandLogo } from "@/modules/shop/shell/aks-brand-logo";

import { Reveal } from "./reveal";
import {
  ImageSlotPlaceholder,
  type SilhouetteId,
} from "./silhouette-svg";
import Image from "next/image";

/** Distinct tones so empty doors never collapse to the same pale wash. */
const DOOR_META: Record<
  string,
  { silhouette: SilhouetteId; bg: string }
> = {
  essentials: {
    silhouette: "kurta",
    bg: "linear-gradient(160deg,#E3D7C0,#A89472)",
  },
  tailored: {
    silhouette: "layered",
    bg: "linear-gradient(160deg,#D4C6AE,#8F8068)",
  },
  occasion: {
    silhouette: "peshwaz",
    bg: "linear-gradient(160deg,#DDD0B8,#9A8668)",
  },
  signature: {
    silhouette: "farshi",
    bg: "linear-gradient(160deg,#C8B898,#7A6B52)",
  },
};

function doorMeta(categoryKey: string) {
  const key = categoryKey.trim().toLowerCase();
  return DOOR_META[key] ?? DOOR_META.essentials!;
}

export function CategoryDoors({
  tiles,
  fallbackDoors,
  eyebrow,
  title,
  exploreTemplate,
}: {
  tiles: CategoryTilePublic[];
  fallbackDoors: HouseCollectionPublic[];
  eyebrow: string;
  title: string;
  /** @deprecated Admin tags are not shown on the storefront. */
  slotTag?: string;
  exploreTemplate: (name: string) => string;
}) {
  const doors =
    tiles.length > 0
      ? tiles
      : fallbackDoors
          .filter((c) => c.slug !== "separates")
          .slice(0, 4)
          .map((c) => ({
            id: c.slug,
            categoryKey: c.slug,
            displayName: c.navLabel,
            caption: c.tagline,
            href: `/collections/${c.slug}`,
            imageUrl: null as string | null,
          }));

  // Single host node (not a Fragment) so SSR HTML and client hydration
  // stay aligned under <main> — Fragments as mapped section roots have
  // caused main↔first-child mismatches in this tree.
  return (
    <div className="cats-block">
      <Reveal as="section" className="cats" id="cats">
        <div className="cats-head">
          <AksBrandLogo variant="mark" className="cats-mark" />
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="serif">{title}</h2>
        </div>
        <div className="cats-grid">
        {doors.map((door) => {
          const meta = doorMeta(door.categoryKey);
          return (
            <Link key={door.id} href={door.href as "/collections"} className="cat">
              {/* Always paint door tone underneath — pale/missing photos stay readable */}
              <ImageSlotPlaceholder
                silhouette={meta.silhouette}
                background={meta.bg}
              />
              {door.imageUrl ? (
                <div className="imgslot cat-photo" style={{ position: "absolute", inset: 0 }}>
                  <Image
                    src={door.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : null}
              <div className="label">
                <div className="n serif">{door.displayName}</div>
                <div className="m">{door.caption}</div>
                <div className="go">
                  {exploreTemplate(door.displayName)} →
                </div>
              </div>
            </Link>
          );
        })}
        </div>
      </Reveal>
    </div>
  );
}
