import Image from "next/image";

import { Link } from "@/i18n/routing";
import { renderAccentText } from "@/modules/content/accent-text";
import type { HeroSlidePublic } from "@/modules/content/types";

import { ImageSlotPlaceholder } from "./silhouette-svg";

export function HomeHero({
  slide,
  fallback,
}: {
  slide: HeroSlidePublic | null;
  fallback: {
    eyebrow: string;
    line1: string;
    line2: React.ReactNode;
    sub: string;
    cta: string;
    slotTag: string;
    slotCap: string;
  };
}) {
  const eyebrow = slide?.eyebrow || fallback.eyebrow;
  const sub = slide?.subtext || fallback.sub;
  const cta = slide?.buttonLabel || fallback.cta;
  const href = slide?.buttonHref || "#cats";
  const imageUrl = slide?.desktopImageUrl || slide?.mobileImageUrl;
  const centre = slide?.textPosition === "CENTRE";
  const overlay = slide?.overlayStrength ?? 40;

  return (
    <div
      id="top"
      className="hero"
      style={
        {
          ["--hero-overlay" as string]: String(overlay / 100),
        } as React.CSSProperties
      }
    >
      {imageUrl ? (
        <div className="imgslot" style={{ position: "absolute", inset: 0 }}>
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <ImageSlotPlaceholder silhouette="farshi" fill="#F4EEE1" />
      )}
      <span className="slot-tag">{fallback.slotTag}</span>
      <div className="hero-inner">
        <div
          className="hero-copy"
          style={centre ? { textAlign: "center", marginInline: "auto" } : undefined}
        >
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="hero-h">
            {slide?.headline ? (
              <span>{renderAccentText(slide.headline)}</span>
            ) : (
              <>
                <span>{fallback.line1}</span>
                <span>{fallback.line2}</span>
              </>
            )}
          </h1>
          <p className="hero-sub">{sub}</p>
          <div className="hero-cta">
            {href.startsWith("#") ? (
              <a href={href}>{cta}</a>
            ) : (
              <Link href={href as "/collections"}>{cta}</Link>
            )}
          </div>
        </div>
      </div>
      <div className="hero-slotcap">{fallback.slotCap}</div>
    </div>
  );
}
