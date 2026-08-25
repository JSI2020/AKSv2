import Image from "next/image";

import { Link } from "@/i18n/routing";
import type { CategoryTilePublic } from "@/modules/content/types";
import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

import { Reveal } from "./reveal";
import {
  ImageSlotPlaceholder,
  type SilhouetteId,
} from "./silhouette-svg";

const DOOR_META: Record<
  string,
  { silhouette: SilhouetteId; bg: string }
> = {
  essentials: {
    silhouette: "kurta",
    bg: "linear-gradient(160deg,#EAE1CF,#BFAA88)",
  },
  tailored: {
    silhouette: "layered",
    bg: "linear-gradient(160deg,#DDD2BC,#A89A80)",
  },
  occasion: {
    silhouette: "peshwaz",
    bg: "linear-gradient(160deg,#F4EEE1,#CDC0A8)",
  },
  signature: {
    silhouette: "farshi",
    bg: "linear-gradient(160deg,#CDC0A8,#8D7E66)",
  },
};

export function CategoryDoors({
  tiles,
  eyebrow,
  title,
  slotTag,
  exploreTemplate,
}: {
  tiles: CategoryTilePublic[];
  eyebrow: string;
  title: string;
  slotTag: string;
  exploreTemplate: (name: string) => string;
}) {
  const doors =
    tiles.length > 0
      ? tiles
      : HOUSE_COLLECTIONS.filter((c) =>
          ["essentials", "tailored", "occasion", "signature"].includes(c.slug),
        ).map((c) => ({
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
      <Reveal className="cats-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="serif">{title}</h2>
      </Reveal>
      <Reveal as="section" className="cats" id="cats">
        {doors.map((door) => {
          const meta = DOOR_META[door.categoryKey] ?? DOOR_META.essentials!;
          return (
            <Link key={door.id} href={door.href as "/collections"} className="cat">
              {door.imageUrl ? (
                <div className="imgslot" style={{ position: "absolute", inset: 0 }}>
                  <Image
                    src={door.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <ImageSlotPlaceholder
                  silhouette={meta.silhouette}
                  background={meta.bg}
                />
              )}
              <span className="slot-tag">{slotTag}</span>
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
      </Reveal>
    </div>
  );
}
