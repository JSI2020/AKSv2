"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";

import type { GalleryAngle, ResolvedImageTriple } from "./types";
import { GALLERY_ANGLES } from "./design-detail-search-params";

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

export function DesignGallery({
  images,
  angle,
  designName,
  onAngleChange,
}: Props) {
  const touchStartX = useRef<number | null>(null);

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
        GALLERY_ANGLES[(idx + direction + GALLERY_ANGLES.length) %
          GALLERY_ANGLES.length];
      if (next) onAngleChange(next);
    },
    [angle, onAngleChange],
  );

  return (
    <div className="grid gap-8 md:grid-cols-[90px_1fr] md:gap-4">
      <div className="order-2 flex flex-row gap-3.5 md:order-1 md:flex-col">
        {GALLERY_ANGLES.map((a) => {
          const img = images[a];
          const active = a === angle;
          return (
            <button
              key={a}
              type="button"
              aria-label={ANGLE_LABELS[a]}
              aria-current={active ? "true" : undefined}
              onClick={() => onAngleChange(a)}
              className={
                active
                  ? "border border-ink bg-greige-deep/30"
                  : "border border-greige-deep bg-transparent"
              }
            >
              {img?.url ? (
                <Image
                  src={img.url}
                  alt={img.altText || `${designName} — ${ANGLE_LABELS[a]}`}
                  width={90}
                  height={110}
                  className="aspect-[9/11] h-[110px] w-[90px] object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex aspect-[9/11] h-[110px] w-[90px] items-center justify-center bg-greige-deep/40 text-[10px] uppercase tracking-[0.08em] text-ink/45">
                  {ANGLE_LABELS[a]}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div
        className="relative order-1 aspect-[4/5] w-full max-h-[640px] touch-pan-y md:order-2"
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
              className="absolute inset-0 transition-opacity duration-300 ease-in-out"
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
                <div className="flex h-full w-full items-center justify-center bg-greige-deep/40 text-[13px] text-ink/45">
                  {designName} — {ANGLE_LABELS[a]}
                </div>
              )}
            </div>
          );
        })}

        <div className="absolute inset-0 hidden md:grid md:grid-cols-3">
          {GALLERY_ANGLES.map((a) => (
            <button
              key={a}
              type="button"
              aria-label={`View ${ANGLE_LABELS[a]}`}
              className="h-full w-full cursor-crosshair bg-transparent"
              onMouseEnter={() => onAngleChange(a)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
