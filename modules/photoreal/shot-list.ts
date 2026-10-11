/**
 * "Photograph a dress" shots. A shot is a commercial pose id (the full
 * library, with preview photos), plus one special shot for mannequin /
 * hanger / flat sources: "as photographed" — copy the source framing.
 */
import {
  COMMERCIAL_POSES,
  type CommercialPose,
} from "./commercial-poses";

export const AS_PHOTOGRAPHED = "as-photographed";

/** Most photos in one shoot (also the ZIP limit). */
export const MAX_SHOTS_PER_SHOOT = 12;

export const SHOT_CATEGORIES = [
  "Standing",
  "Portrait",
  "Walking",
  "Leaning",
  "Seated",
  "Editorial",
  "Back",
  "Detail",
] as const satisfies readonly CommercialPose["category"][];

export const SHOT_PRESETS = [
  { id: "front", label: "Just the front", shots: ["front-straight"] },
  {
    id: "standard",
    label: "Standard set (4)",
    shots: ["front-straight", "three-quarter-stand", "portrait-half", "back-three-quarter"],
  },
  {
    id: "social",
    label: "Social media (6)",
    shots: [
      "walk-toward",
      "portrait-laugh",
      "over-shoulder",
      "editorial-dupatta-lift",
      "portrait-smile",
      "detail-embroidery",
    ],
  },
  {
    id: "lookbook",
    label: "Lookbook (8)",
    shots: [
      "front-straight",
      "three-quarter-stand",
      "walk-toward",
      "lean-wall",
      "portrait-half",
      "seated-chair",
      "back-three-quarter",
      "detail-embroidery",
    ],
  },
] as const;

export function poseLabel(id: string): string {
  if (id === AS_PHOTOGRAPHED) return "As photographed";
  return COMMERCIAL_POSES.find((p) => p.id === id)?.label ?? id;
}

export function poseCategory(id: string): CommercialPose["category"] | null {
  if (id === AS_PHOTOGRAPHED) return "Standing";
  return COMMERCIAL_POSES.find((p) => p.id === id)?.category ?? null;
}

/** Preview photo of the pose (generated once, in /public). */
export function posePreviewSrc(id: string): string {
  return `/studio-poses/${id === AS_PHOTOGRAPHED ? "front-straight" : id}.webp`;
}

/**
 * Pose to request for a shot. For a mannequin/hanger/flat source the
 * catalogue front becomes "as photographed" (copy the source framing).
 */
export function poseForShot(
  shotId: string,
  source: "mannequin" | "person",
): string | null {
  if (shotId === AS_PHOTOGRAPHED) return null;
  if (source === "mannequin" && shotId === "front-straight") return null;
  return shotId;
}

/** Quick refine actions on a result card. */
export const VARIATION_POSES = [
  "hand-on-hip",
  "weight-shift",
  "looking-away",
  "lean-wall",
  "walk-toward",
  "over-shoulder",
  "side-glance",
  "editorial-hands-behind",
  "editorial-candid-glance",
  "editorial-cross-ankle",
  "front-relaxed",
  "three-quarter-stand",
] as const;

export const CLOSER_POSES = ["portrait-half", "portrait-smile"] as const;
