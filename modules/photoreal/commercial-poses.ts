/**
 * Commercial fashion pose / camera library for Design Photos angle slots.
 * Used so generations are not stuck on a stiff standing catalogue pose.
 */

export type CommercialPose = {
  id: string;
  label: string;
  category:
    | "Standing"
    | "Leaning"
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
  // Leaning
  {
    id: "lean-wall",
    label: "Lean · shoulder on wall",
    category: "Leaning",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: casually leaning one shoulder against a wall or pillar, weight on one leg, free hand relaxed at the side or lightly on the thigh, relaxed commercial fashion stance — full garment readable.",
  },
  {
    id: "lean-hip-wall",
    label: "Lean · hip on wall",
    category: "Leaning",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: hip leaning into a wall or column, torso angled slightly toward camera, opposite shoulder open, one ankle crossed over the other, quiet luxury campaign lean — not slouching.",
  },
  {
    id: "lean-back-wall",
    label: "Lean · back to wall",
    category: "Leaning",
    cameraAngle: "FRONT",
    prompt:
      "Pose: back lightly against a wall, both shoulders touching, feet a step forward, chin soft, arms relaxed — calm front-facing commercial lean that shows the full outfit.",
  },
  {
    id: "lean-doorway",
    label: "Lean · doorway",
    category: "Leaning",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: leaning in a doorway frame, one shoulder and hip resting on the jamb, body three-quarter to camera, elegant and modest commercial fashion lean.",
  },
  {
    id: "lean-railing",
    label: "Lean · railing",
    category: "Leaning",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: casually leaning forearms or one elbow on a balcony railing or low wall, weight shifted forward slightly, looking toward or past camera — outdoor lookbook lean, dress fully visible.",
  },
  {
    id: "lean-counter",
    label: "Lean · console / ledge",
    category: "Leaning",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: standing beside a console table or ledge, one hand resting lightly on the surface, body angled, soft weight on the near hip — interior commercial fashion lean.",
  },
  {
    id: "lean-window",
    label: "Lean · window sill",
    category: "Leaning",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: leaning near a window, one hand on the sill, soft side light on the face, body angled three-quarter, serene campaign mood — garment silhouette clear from neckline to hem.",
  },
  {
    id: "lean-pillar-cross",
    label: "Lean · pillar · crossed ankles",
    category: "Leaning",
    cameraAngle: "FRONT",
    prompt:
      "Pose: leaning a shoulder against a pillar or column, ankles casually crossed, one hand near the waist or sleeve, front-facing commercial fashion lean with relaxed elegance.",
  },
  {
    id: "lean-arch",
    label: "Lean · arch / niche",
    category: "Leaning",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: framed in an architectural arch or wall niche, one shoulder and hip resting into the recess, body turned slightly toward camera — editorial courtyard lean, modest and polished.",
  },
  {
    id: "lean-forward-soft",
    label: "Lean · soft forward",
    category: "Leaning",
    cameraAngle: "FRONT",
    prompt:
      "Pose: standing with a soft forward lean from the hips (not a bow), weight on both feet, hands lightly clasped or resting at the front — intimate commercial portrait lean that still shows the dress.",
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
  {
    id: "editorial-midturn",
    label: "Caught mid-turn",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: captured mid-turn as in a real fashion shoot — body rotating, fabric catching slight motion, eyes finding the camera, editorial stillness with life. Full outfit readable.",
  },
  {
    id: "editorial-chin-down",
    label: "Chin down · eyes up",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: classic editorial face — chin gently down, eyes lifted toward the camera, soft closed-mouth expression, shoulders relaxed, quiet-luxury campaign portrait energy while the full garment stays visible.",
  },
  {
    id: "editorial-hand-collar",
    label: "Hand at neckline",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: one hand lightly at the neckline or collar as if settling the fabric between frames, natural photo-shoot moment, three-quarter body, modest and commercial.",
  },
  {
    id: "editorial-dupatta-lift",
    label: "Dupatta / drape lift",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: lightly lifting or settling a dupatta or outer drape with one hand so fabric arcs naturally — real lookbook motion, not stiff. Keep the base garment silhouette clear.",
  },
  {
    id: "editorial-hands-behind",
    label: "Hands behind back",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: standing front with hands loosely clasped behind the back, open chest and clear silhouette, calm editorial campaign stance — real photographer direction, not mannequin-stiff.",
  },
  {
    id: "editorial-cross-ankle",
    label: "Standing · crossed ankles",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: standing with ankles softly crossed, weight on the back foot, arms relaxed or one hand at the waist, polished lookbook framing as directed on a real set.",
  },
  {
    id: "editorial-low-angle",
    label: "Hero low angle",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: standing tall toward camera; camera placed slightly low for a hero editorial fashion-magazine frame — lengthening the silhouette, modest and powerful, full dress visible.",
  },
  {
    id: "editorial-candid-glance",
    label: "Between takes · candid",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: candid between-takes energy from a real photo shoot — soft laugh or mid-conversation glance past the camera, natural shoulders, fabric settling, still clearly a commercial fashion photograph.",
  },
  {
    id: "editorial-look-down",
    label: "Looking down at hem",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: gazing softly down toward the hem or floor as if checking the fall of the dress, one hand lightly adjusting fabric — intimate editorial moment, full length still readable.",
  },
  {
    id: "editorial-profile-stop",
    label: "Profile stop",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: full side/profile body stopped mid-stride, head in clean profile or slight turn toward lens, fashion-editorial silhouette shot as on a real outdoor set.",
  },
  {
    id: "editorial-floor-sit",
    label: "Floor sit · editorial",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: seated gracefully on a clean floor or low rug, knees angled to one side, upright torso, one hand resting on the floor for balance — magazine editorial seating that keeps the garment clear.",
  },
  {
    id: "editorial-waist-frame",
    label: "Hands frame waist",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: both hands lightly framing the waist or hip seam as a photographer would direct for shape — elegant, modest, commercial editorial, full outfit visible.",
  },
  {
    id: "editorial-hair-tuck",
    label: "Hair tuck · soft",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: one hand softly tucking hair behind an ear or settling a strand, three-quarter body, natural on-set beauty moment — keep focus on the garment silhouette.",
  },
  {
    id: "editorial-power-stance",
    label: "Power stance · feet apart",
    category: "Editorial",
    cameraAngle: "FRONT",
    prompt:
      "Pose: confident fashion power stance — feet slightly apart, shoulders square to camera, chin level, arms relaxed at sides — real campaign hero frame, quiet and strong, not aggressive.",
  },
  {
    id: "editorial-one-knee",
    label: "One knee down · set",
    category: "Editorial",
    cameraAngle: "THREE_QUARTER",
    prompt:
      "Pose: one knee down on a clean surface, other foot planted, torso upright, as directed for an editorial floor set — modest, elegant, garment folds readable.",
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
