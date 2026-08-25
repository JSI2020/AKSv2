/** SVG silhouette placeholders from Quiet Luxury prototype (defs). */

import type { ReactNode } from "react";

export type SilhouetteId =
  | "kurta"
  | "farshi"
  | "angrakha"
  | "layered"
  | "peshwaz";

const PATHS: Record<SilhouetteId, ReactNode> = {
  kurta: (
    <>
      <path d="M100 30 Q86 33 84 52 Q70 58 68 88 L58 210 Q54 300 50 400 L86 405 Q98 300 100 210 L100 405 L114 405 L114 210 Q116 300 128 405 L164 400 Q160 300 156 210 L146 88 Q144 58 130 52 Q128 33 114 30 Q107 26 100 30 Z" />
      <path
        d="M100 58 L100 405 M84 92 Q80 260 74 400 M116 92 Q120 260 126 400"
        fill="none"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <ellipse cx="107" cy="16" rx="13" ry="15" opacity="0.85" />
    </>
  ),
  farshi: (
    <>
      <path d="M100 28 Q84 32 82 54 Q66 60 64 92 L54 230 Q40 340 28 430 L96 438 Q104 320 104 230 L104 438 L120 438 L120 230 Q128 340 148 430 L188 420 Q176 330 164 230 L152 92 Q150 60 134 54 Q132 32 116 28 Q108 24 100 28 Z" />
      <path
        d="M104 56 L104 438 M82 96 Q66 320 40 430 M126 96 Q150 320 176 425"
        fill="none"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <ellipse cx="108" cy="15" rx="13" ry="15" opacity="0.85" />
    </>
  ),
  angrakha: (
    <>
      <path d="M100 30 Q86 33 84 52 Q70 58 68 88 L58 220 Q54 320 52 410 L150 410 Q148 320 144 220 L146 88 Q144 58 130 52 Q128 33 114 30 Q107 26 100 30 Z" />
      <path
        d="M84 60 Q120 120 150 100 M84 80 Q118 150 130 260 L100 410"
        fill="none"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <circle cx="112" cy="120" r="2.5" opacity="0.5" />
      <circle cx="108" cy="160" r="2.5" opacity="0.5" />
      <ellipse cx="107" cy="16" rx="13" ry="15" opacity="0.85" />
    </>
  ),
  layered: (
    <>
      <path d="M100 30 Q86 33 84 52 Q70 58 68 88 L58 230 Q54 330 52 415 L148 415 Q146 330 142 230 L146 88 Q144 58 130 52 Q128 33 114 30 Q107 26 100 30 Z" />
      <path
        d="M78 70 L74 400 M132 70 L136 400"
        fill="none"
        strokeWidth="1"
        opacity="0.55"
      />
      <path
        d="M100 58 L100 415"
        fill="none"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <ellipse cx="107" cy="16" rx="13" ry="15" opacity="0.85" />
    </>
  ),
  peshwaz: (
    <>
      <path d="M100 30 Q86 33 84 52 Q72 58 72 84 L74 130 Q60 260 48 410 L152 410 Q140 260 126 130 L128 84 Q128 58 116 52 Q114 33 100 30 Z" />
      <path
        d="M72 130 L128 130"
        fill="none"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <path
        d="M100 130 L100 410 M86 150 Q68 300 56 405 M114 150 Q132 300 144 405"
        fill="none"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <ellipse cx="100" cy="16" rx="13" ry="15" opacity="0.85" />
    </>
  ),
};

export function SilhouetteSvg({
  id,
  fill = "rgba(244,238,225,.92)",
  stroke = "rgba(43,41,38,.22)",
}: {
  id: SilhouetteId;
  fill?: string;
  stroke?: string;
}) {
  return (
    <svg viewBox="0 0 214 460" preserveAspectRatio="xMidYMax meet" aria-hidden>
      <g fill={fill} stroke={stroke} strokeWidth="0.5">
        {PATHS[id]}
      </g>
    </svg>
  );
}

export function ImageSlotPlaceholder({
  silhouette,
  background,
  fill,
  className,
  tag,
}: {
  silhouette: SilhouetteId;
  background?: string;
  fill?: string;
  className?: string;
  tag?: string;
}) {
  return (
    <div
      className={["imgslot", className].filter(Boolean).join(" ")}
      style={background ? { background } : undefined}
    >
      <div className="grain" />
      <div className="figure">
        <SilhouetteSvg id={silhouette} fill={fill} />
      </div>
      {tag ? <span className="slot-tag">{tag}</span> : null}
    </div>
  );
}
