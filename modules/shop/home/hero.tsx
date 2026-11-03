import { ShopImage } from "@/modules/shop/media/shop-image";

import { Link } from "@/i18n/routing";
import { normalizeDashes, renderAccentText } from "@/modules/content/accent-text";
import type { HeroSlidePublic } from "@/modules/content/types";

import { ImageSlotPlaceholder } from "./silhouette-svg";

/** Two-line house lockup — keeps hierarchy without mid-frame stacking. */
function HeroHeadline({
  slideHeadline,
  line1,
  line2,
}: {
  slideHeadline: string | null | undefined;
  line1: string;
  line2: React.ReactNode;
}) {
  if (!slideHeadline?.trim()) {
    return (
      <>
        <span className="hero-h-line">{line1}</span>
        <span className="hero-h-line">{line2}</span>
      </>
    );
  }

  const raw = slideHeadline.replace(/\r/g, "").trim();
  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    return (
      <>
        <span className="hero-h-line">{renderAccentText(lines[0]!)}</span>
        <span className="hero-h-line">{renderAccentText(lines.slice(1).join(" "))}</span>
      </>
    );
  }

  // "The cut is the *ornament*." → two lines
  const m = lines[0]!.match(/^(.*?)\s+(the\s+.+)$/i);
  if (m?.[1] && m[2]) {
    return (
      <>
        <span className="hero-h-line">{renderAccentText(m[1])}</span>
        <span className="hero-h-line">{renderAccentText(m[2])}</span>
      </>
    );
  }

  return (
    <span className="hero-h-line">{renderAccentText(lines[0]!)}</span>
  );
}

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
  // Normalize em-dashes → spaced en-dashes at render, so stale slide/announcement
  // copy in the DB matches the house convention without a data migration.
  const eyebrow = normalizeDashes(slide?.eyebrow || fallback.eyebrow);
  const sub = normalizeDashes(slide?.subtext || fallback.sub);
  const cta = slide?.buttonLabel || fallback.cta;
  const href = slide?.buttonHref || "#cats";
  const imageUrl = slide?.desktopImageUrl || slide?.mobileImageUrl;
  const overlay = Math.max(50, slide?.overlayStrength ?? 58);

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
          <ShopImage
            src={imageUrl}
            alt={slide?.headline?.replace(/\s+/g, " ").trim() || "AKS-Atelier ready-to-wear"}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_35%]"
          />
        </div>
      ) : (
        <ImageSlotPlaceholder silhouette="farshi" fill="#F4EEE1" />
      )}
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="hero-h">
            <HeroHeadline
              slideHeadline={slide?.headline}
              line1={fallback.line1}
              line2={fallback.line2}
            />
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
    </div>
  );
}
