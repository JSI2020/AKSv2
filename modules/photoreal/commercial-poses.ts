/**
 * Commercial fashion pose / camera library for Design Photos angle slots.
 * Used so generations are not stuck on a stiff standing catalogue pose.
 */

export type CommercialPose = {
  id: string;
  label: string;
  category:
    | "Standing"
    | "Walking"
    | "Seated"
    | "Editorial"
    | "Detail"
    | "Back";
  /** Maps to design_renders.angle / gallery generation slot. */
  cameraAngle: "FRONT" | "THREE_QUARTER" | "BACK" | "DETAIL";
  /** Injected into the fal prompt. */
  prompt: string;
};

export const COMMERCIAL_POSES: CommercialPose[] = [
  // Standing
  {
    id: "front-relaxed",
    label: "Relaxed front",
    category: "Standing",
    cameraAngle: "FRONT",
    prompt:
      "Pose: facing camera but relaxed, soft knee bend, natural arm placement, slight head tilt — real commercial photography, not rigid military stand.",
  },
  {
    id: "hand-on-hip",
    label: "Hand on hip",
    category: "Standing",
    cameraAngle: "FRONT",
    prompt:
      "Pose: standing with one hand lightly on hip, soft contrapposto (weight shift), chin slightly down, high-end commercial campaign stance.",
  },
  {
    id: "three-quarter-stand",
    label: "3/4 stand",
    category: "Standing",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: standing three-quarter turn, weight on back leg, front foot soft, one hand lightly adjusting sleeve or dupatta — editorial catalogue energy, not stiff front-on.",
  },
  {
    id: "lean-wall",
    label: "Lean on wall",
    category: "Standing",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: casually leaning one shoulder against a wall or pillar, weight on one leg, relaxed commercial fashion stance.",
  },
  {
    id: "weight-shift",
    label: "Weight shift",
    category: "Standing",
    cameraAngle: "FRONT",
    prompt:
      "Pose: classic fashion weight shift — one hip slightly out, opposite knee soft, arms relaxed, catalogue-ready full-length.",
  },
  {
    id: "arms-crossed-soft",
    label: "Soft crossed arms",
    category: "Standing",
    cameraAngle: "FRONT",
    prompt:
      "Pose: standing with arms lightly crossed at waist or loosely folded, elegant and modest, full outfit readable.",
  },
  {
    id: "looking-away",
    label: "Looking away",
    category: "Standing",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: body toward camera, face turned softly away / profile glance, calm editorial stillness.",
  },
  // Walking
  {
    id: "walk-toward",
    label: "Walking toward camera",
    category: "Walking",
    cameraAngle: "FRONT",
    prompt:
      "Pose: natural mid-stride walk toward the camera, one foot forward, fabric in slight motion, confident commercial fashion walk — not stiff or mannequin-still.",
  },
  {
    id: "walk-past",
    label: "Walking past",
    category: "Walking",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: walking across frame in profile/three-quarter, captured mid-step like a street or editorial campaign photo, dress drape moving naturally.",
  },
  {
    id: "walk-away-glance",
    label: "Walk away · glance back",
    category: "Walking",
    cameraAngle: "BACK",
    prompt:
      "Pose: walking away from camera, looking back over one shoulder, fabric trailing naturally — commercial campaign exit frame.",
  },
  {
    id: "stairs",
    label: "On steps",
    category: "Walking",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: standing on stairs or a step, one foot higher, body angled, as in a real outdoor fashion campaign.",
  },
  // Seated
  {
    id: "seated-ledge",
    label: "Seated ledge",
    category: "Seated",
    cameraAngle: "FRONT",
    prompt:
      "Pose: seated on a low ledge, stool, or garden step, ankles crossed or one knee slightly angled, upright torso, commercial lookbook seating — full outfit still readable.",
  },
  {
    id: "seated-chair",
    label: "Seated chair",
    category: "Seated",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: sitting in a chair or armchair at a slight angle, relaxed shoulders, hands resting naturally, modest commercial portrait framing that still shows the garment.",
  },
  {
    id: "crouch-soft",
    label: "Soft crouch",
    category: "Seated",
    cameraAngle: "FRONT",
    prompt:
      "Pose: gentle fashion crouch / kneel on one knee on a clean surface, modest and elegant, camera slightly above, garment folds readable — commercial editorial, not casual selfie.",
  },
  // Editorial
  {
    id: "over-shoulder",
    label: "Over shoulder",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: looking back over one shoulder toward the camera, body angled away, graceful editorial turn that shows the outfit silhouette.",
  },
  {
    id: "side-glance",
    label: "Side glance",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: body in side/three-quarter profile, eyes glancing toward camera, fashion editorial stillness with life — not a blank mannequin pose.",
  },
  {
    id: "wind-drape",
    label: "Wind in fabric",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: standing front, soft breeze catching sleeves or dupatta so fabric moves, still elegant and controlled commercial motion.",
  },
  {
    id: "hands-in-pockets",
    label: "Hands in pockets",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: relaxed standing with hands lightly in pockets or resting at seams, modern commercial quiet luxury stance.",
  },
  {
    id: "mirror-check",
    label: "Mirror check",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: three-quarter, as if checking a mirror — one hand adjusting collar or cuff, natural fashion moment, full garment visible.",
  },
  // Back
  {
    id: "back-full",
    label: "Full back",
    category: "Back",
    cameraAngle: "BACK",
    prompt:
      "Pose: full back view, standing relaxed, head in soft profile or looking forward away from camera, clear back silhouette, neckline, and hem — catalogue back shot.",
  },
  {
    id: "back-three-quarter",
    label: "Back 3/4",
    category: "Back",
    cameraAngle: "BACK",
    prompt:
      "Pose: back three-quarter angle showing rear silhouette and side seam, one shoulder slightly toward camera, commercial lookbook back.",
  },
  {
    id: "back-over-shoulder",
    label: "Back · over shoulder",
    category: "Back",
    cameraAngle: "BACK",
    prompt:
      "Pose: primarily back view with face glancing over one shoulder toward camera, elegant and modest.",
  },
  // Detail
  {
    id: "detail-neckline",
    label: "Neckline detail",
    category: "Detail",
    cameraAngle: "DETAIL",
    prompt:
      "Framing: close commercial detail of neckline and upper chest, fabric texture sharp, embroidery readable, soft studio light — not a face portrait.",
  },
  {
    id: "detail-sleeve",
    label: "Sleeve / cuff detail",
    category: "Detail",
    cameraAngle: "DETAIL",
    prompt:
      "Framing: close commercial detail of sleeve, cuff, or embroidery placement, true fabric hand, catalogue crop.",
  },
  {
    id: "detail-hem",
    label: "Hem / drape detail",
    category: "Detail",
    cameraAngle: "DETAIL",
    prompt:
      "Framing: close commercial detail of hem, slit, or fabric drape near the knee, sharp texture, soft shadows.",
  },
  {
    id: "detail-embroidery",
    label: "Embroidery close-up",
    category: "Detail",
    cameraAngle: "DETAIL",
    prompt:
      "Framing: tight commercial close-up of embroidery or finishing detail exactly as designed — do not invent motifs.",
  },
];

/** Keep current framing on refine unless the user asks for a new pose. */
export const KEEP_POSE_LINE =
  "Pose continuity: keep the same body pose, stance, and camera angle as the previous photograph unless a pose change is explicitly requested.";

const LEGACY_ANGLE_TO_POSE: Record<string, string> = {
  FRONT: "front-relaxed",
  THREE_QUARTER: "three-quarter-stand",
  BACK: "back-full",
  DETAIL: "detail-neckline",
};

export function poseById(id: string): CommercialPose | undefined {
  return COMMERCIAL_POSES.find((p) => p.id === id);
}

/** @deprecated alias — prefer poseById */
export function getCommercialPoseById(
  id?: string | null,
): CommercialPose | undefined {
  if (!id) return undefined;
  return poseById(id);
}

/** Normalise saved studioAnglePicks (pose ids or legacy RENDER_ANGLES). */
export function resolveStudioPosePicks(raw: string[] | null | undefined): [
  CommercialPose,
  CommercialPose,
  CommercialPose,
] {
  const defaults = [
    poseById("front-relaxed")!,
    poseById("three-quarter-stand")!,
    poseById("back-full")!,
  ] as [CommercialPose, CommercialPose, CommercialPose];

  if (!raw || raw.length !== 3) return defaults;

  return raw.map((entry, i) => {
    const asPose = poseById(entry);
    if (asPose) return asPose;
    const mapped = LEGACY_ANGLE_TO_POSE[entry];
    return (mapped ? poseById(mapped) : undefined) ?? defaults[i]!;
  }) as [CommercialPose, CommercialPose, CommercialPose];
}

export function pickRandomCommercialPose(
  excludeId?: string,
): CommercialPose {
  const pool = excludeId
    ? COMMERCIAL_POSES.filter((p) => p.id !== excludeId)
    : COMMERCIAL_POSES;
  const list = pool.length ? pool : COMMERCIAL_POSES;
  return list[Math.floor(Math.random() * list.length)]!;
}

export function commercialPosePrompt(id?: string): string {
  if (!id) return pickRandomCommercialPose().prompt;
  return poseById(id)?.prompt ?? pickRandomCommercialPose().prompt;
}
