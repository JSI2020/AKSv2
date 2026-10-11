/**
 * "Photograph a dress" shot list — what a stylist ticks on a shoot brief.
 * Each shot maps to a commercial pose; `poseId: null` means "as photographed"
 * (copy the source framing — mannequin mode) or the model's natural front.
 */
export type ShotId =
  | "front"
  | "three-quarter"
  | "portrait"
  | "close-up"
  | "back"
  | "seated"
  | "walking"
  | "lifestyle";

export type Shot = {
  id: ShotId;
  label: string;
  hint: string;
  /** Pose for a dress worn by a person (repose mode). */
  poseId: string;
  /**
   * Pose for a mannequin / hanger / flat source. null = match the source
   * framing (the first, most faithful shot).
   */
  mannequinPoseId: string | null;
};

export const SHOTS: readonly Shot[] = [
  {
    id: "front",
    label: "Front",
    hint: "Full length, facing camera",
    poseId: "front-straight",
    mannequinPoseId: null,
  },
  {
    id: "three-quarter",
    label: "3/4 turn",
    hint: "Full length, body turned",
    poseId: "three-quarter-stand",
    mannequinPoseId: "three-quarter-stand",
  },
  {
    id: "portrait",
    label: "Portrait",
    hint: "Waist up, warm smile",
    poseId: "portrait-half",
    mannequinPoseId: "portrait-half",
  },
  {
    id: "close-up",
    label: "Close-up",
    hint: "Chest up, neckline detail",
    poseId: "portrait-smile",
    mannequinPoseId: "portrait-smile",
  },
  {
    id: "back",
    label: "Back",
    hint: "Back view of the garment",
    poseId: "back-three-quarter",
    mannequinPoseId: "back-three-quarter",
  },
  {
    id: "seated",
    label: "Seated",
    hint: "Graceful seated pose",
    poseId: "seated-sofa",
    mannequinPoseId: "seated-sofa",
  },
  {
    id: "walking",
    label: "Walking",
    hint: "Mid-stride toward camera",
    poseId: "walk-toward",
    mannequinPoseId: "walk-toward",
  },
  {
    id: "lifestyle",
    label: "Candid",
    hint: "Natural laugh, relaxed",
    poseId: "portrait-laugh",
    mannequinPoseId: "portrait-laugh",
  },
] as const;

/** The four frames a brand shoot delivers per look. */
export const STANDARD_SET: readonly ShotId[] = [
  "front",
  "three-quarter",
  "portrait",
  "back",
];

export function shotById(id: ShotId): Shot {
  return SHOTS.find((s) => s.id === id)!;
}

/** Pose to request for a shot, given what the source photo shows. */
export function poseForShot(
  shot: Shot,
  source: "mannequin" | "person",
): string | null {
  return source === "mannequin" ? shot.mannequinPoseId : shot.poseId;
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
