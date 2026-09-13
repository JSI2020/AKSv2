"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { GalleryAngle, ResolvedGalleryImages } from "./types";
import { GALLERY_ANGLES } from "./design-detail-search-params";
import { ImageSlotPlaceholder } from "@/modules/shop/home/silhouette-svg";
import { silhouetteForCategory } from "./category-silhouette";

const ANGLE_LABELS: Record<GalleryAngle, string> = {
  FRONT: "Front",
  THREE_QUARTER: "Three-quarter",
  BACK: "Back",
};

type Props = {
  images: ResolvedGalleryImages;
  angle: GalleryAngle;
  designName: string;
  categoryKey: string;
  onAngleChange: (angle: GalleryAngle) => void;
};

function showAiLabel(images: ResolvedGalleryImages): boolean {
  return (["FRONT", "THREE_QUARTER", "BACK"] as const).some(
    (a) => images[a]?.isAiGenerated,
  );
}

export function DesignGallery({
  images,
  angle,
  designName,
  categoryKey,
  onAngleChange,
}: Props) {
  const touchStartX = useRef<number | null>(null);
  const sil = silhouetteForCategory(categoryKey);
  const [fabricIdx, setFabricIdx] = useState<number | null>(null);

  useEffect(() => {
    setFabricIdx(null);
  }, [images, angle]);

  useEffect(() => {
    for (const a of GALLERY_ANGLES) {
      const url = images[a]?.url;
      if (url) {
        const img = new window.Image();
        img.src = url;
      }
    }
    for (const photo of images.fabricPhotos) {
      if (photo.url) {
        const img = new window.Image();
        img.src = photo.url;
      }
    }
  }, [images]);

  const activeFabric =
    fabricIdx != null ? (images.fabricPhotos[fabricIdx] ?? null) : null;

  const allSlides = [
    ...GALLERY_ANGLES.map((a) => ({ kind: "angle" as const, angle: a })),
    ...images.fabricPhotos.map((_, i) => ({ kind: "fabric" as const, index: i })),
  ];

  const activeSlideIdx =
    fabricIdx != null
      ? GALLERY_ANGLES.length + fabricIdx
      : GALLERY_ANGLES.indexOf(angle);

  const cycleSlide = useCallback(
    (direction: 1 | -1) => {
      if (allSlides.length === 0) return;
      const next =
        (activeSlideIdx + direction + allSlides.length) % allSlides.length;
      const slide = allSlides[next];
      if (!slide) return;
      if (slide.kind === "angle") {
        setFabricIdx(null);
        onAngleChange(slide.angle);
      } else {
        setFabricIdx(slide.index);
      }
    },
    [activeSlideIdx, allSlides, onAngleChange],
  );

  return (
    <div className="pdp-visual">
      <div
        className="pdp-stage"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null) return;
          const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
          const delta = endX - touchStartX.current;
          if (Math.abs(delta) > 48) {
            cycleSlide(delta < 0 ? 1 : -1);
          }
          touchStartX.current = null;
        }}
      >
        {activeFabric?.url ? (
          <div className="layer" style={{ opacity: 1 }}>
            <Image
              src={activeFabric.url}
              alt={activeFabric.altText || `${designName} — fabric`}
              fill
              sizes="(max-width: 768px) 100vw, 55vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          GALLERY_ANGLES.map((a) => {
            const img = images[a];
            const visible = fabricIdx == null && a === angle;
            return (
              <div
                key={a}
                aria-hidden={!visible}
                className="layer"
                style={{ opacity: visible ? 1 : 0 }}
              >
                {img?.url ? (
                  <Image
                    src={img.url}
                    alt={img.altText || `${designName} — ${ANGLE_LABELS[a]}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 55vw"
                    className="object-cover"
                    priority={a === "FRONT"}
                    unoptimized
                  />
                ) : (
                  <ImageSlotPlaceholder silhouette={sil} />
                )}
              </div>
            );
          })
        )}

        {showAiLabel(images) && fabricIdx == null ? (
          <span className="slot-tag">AI visualization</span>
        ) : null}
      </div>

      <div className="pdp-angles">
        {GALLERY_ANGLES.map((a) => {
          const img = images[a];
          const active = fabricIdx == null && a === angle;
          return (
            <button
              key={a}
              type="button"
              className={`a${active ? " on" : ""}`}
              aria-label={ANGLE_LABELS[a]}
              aria-current={active ? "true" : undefined}
              onClick={() => {
                setFabricIdx(null);
                onAngleChange(a);
              }}
            >
              {img?.url ? (
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <ImageSlotPlaceholder
                  silhouette={sil}
                  fill="rgba(244,238,225,.85)"
                />
              )}
            </button>
          );
        })}
        {images.fabricPhotos.map((photo, idx) => {
          const active = fabricIdx === idx;
          return (
            <button
              key={`fabric-${photo.assetId}-${idx}`}
              type="button"
              className={`a${active ? " on" : ""}`}
              aria-label="Fabric"
              aria-current={active ? "true" : undefined}
              onClick={() => setFabricIdx(idx)}
            >
              {photo.url ? (
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <ImageSlotPlaceholder
                  silhouette={sil}
                  fill="rgba(244,238,225,.85)"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
