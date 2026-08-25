"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";

import type { GalleryAngle, ResolvedImageTriple } from "./types";
import { GALLERY_ANGLES } from "./design-detail-search-params";
import {
  ImageSlotPlaceholder,
  type SilhouetteId,
} from "@/modules/shop/home/silhouette-svg";

const ANGLE_LABELS: Record<GalleryAngle, string> = {
  FRONT: "Front",
  THREE_QUARTER: "Three-quarter",
  BACK: "Back",
};

type Props = {
  images: ResolvedImageTriple;
  angle: GalleryAngle;
  designName: string;
  onAngleChange: (angle: GalleryAngle) => void;
};

function showAiLabel(images: ResolvedImageTriple): boolean {
  return (["FRONT", "THREE_QUARTER", "BACK"] as const).some(
    (a) => images[a]?.isAiGenerated,
  );
}

export function DesignGallery({
  images,
  angle,
  designName,
  onAngleChange,
}: Props) {
  const touchStartX = useRef<number | null>(null);
  const sil: SilhouetteId = "kurta";

  useEffect(() => {
    for (const a of GALLERY_ANGLES) {
      const url = images[a]?.url;
      if (url) {
        const img = new window.Image();
        img.src = url;
      }
    }
  }, [images]);

  const cycleAngle = useCallback(
    (direction: 1 | -1) => {
      const idx = GALLERY_ANGLES.indexOf(angle);
      const next =
        GALLERY_ANGLES[
          (idx + direction + GALLERY_ANGLES.length) % GALLERY_ANGLES.length
        ];
      if (next) onAngleChange(next);
    },
    [angle, onAngleChange],
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
            cycleAngle(delta < 0 ? 1 : -1);
          }
          touchStartX.current = null;
        }}
      >
        {GALLERY_ANGLES.map((a) => {
          const img = images[a];
          const visible = a === angle;
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
        })}

        {showAiLabel(images) ? (
          <span className="slot-tag">AI visualization</span>
        ) : null}
      </div>

      <div className="pdp-angles">
        {GALLERY_ANGLES.map((a) => {
          const img = images[a];
          const active = a === angle;
          return (
            <button
              key={a}
              type="button"
              className={`a${active ? " on" : ""}`}
              aria-label={ANGLE_LABELS[a]}
              aria-current={active ? "true" : undefined}
              onClick={() => onAngleChange(a)}
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
                <ImageSlotPlaceholder silhouette={sil} fill="rgba(244,238,225,.85)" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
