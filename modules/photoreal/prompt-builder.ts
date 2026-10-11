import {
  getModelPersona,
  resolvePersonaSeed,
  type ModelPersona,
} from "./model-persona";
import {
  COMMERCIAL_POSES,
  KEEP_POSE_LINE,
  getCommercialPoseById,
  pickRandomCommercialPose,
  type CommercialPose,
} from "./commercial-poses";

/** Sketch mode — structure from line art; do not redesign the cut. */
const SKETCH_ANCHOR =
  "Photorealistic fashion photograph that looks like a real camera shot. Reproduce the garment exactly as shown in the attached sketch — same silhouette, neckline, sleeves, hem, and any embroidery or detail, in the same positions. Do not redesign or omit garment details.";

/**
 * Old-design / photo restyle — keep the garment idea, replace the person,
 * and allow a clearer catalogue upgrade on the first pass.
 */
const OLD_DESIGN_ANCHOR =
  "Photorealistic fashion photograph that looks like a real camera shot. The attached image is an OLD DESIGN PHOTO for garment inspiration only. Recreate the outfit as a fresh real photograph: keep the garment type, silhouette, and key dress details, but improve fabric realism, colour richness, and fit. CRITICAL: do NOT keep the original person, face, body, hair, skin tone, or identity from the photo — completely replace them with the house model described below.";

/**
 * Photo → Pose — hard garment lock. Only pose, camera, and house-model identity may change.
 */
const REPOSE_ANCHOR =
  "Photorealistic fashion photograph that looks like a real camera shot. The attached image is the SOURCE GARMENT PHOTO. Reproduce the dress EXACTLY as shown — identical silhouette, neckline, sleeves, hem length, embroidery placement, colourways, fabric appearance, and construction details. Do not redesign, restyle, recolour, shorten, lengthen, or invent new embellishment. CRITICAL: replace the original person completely with the house model below, and restage only pose and camera framing.";

/**
 * Mannequin → model — the garment was shot on a mannequin / dress form. Hard
 * garment lock (nothing about the design may change), transferred onto the
 * house model, and pressed: storage creases and fold lines go, the cloth's
 * real texture and natural drape stay.
 */
const MANNEQUIN_ANCHOR =
  "Photorealistic fashion photograph that looks like a real camera shot. The attached image shows the SOURCE GARMENT displayed on a MANNEQUIN / DRESS FORM, on a HANGER, or laid FLAT — not worn by a person. Dress the house model below in this exact garment and photograph her wearing it. Reproduce the garment EXACTLY as shown — identical silhouette, cut, length, neckline, collar, sleeves and cuffs, slits, hem, colours and shades, print, embroidery motifs and their exact placement and density, lace, cutwork, piping, borders, buttons, tassels, trims, and the fabric's real texture and sheen. Do not redesign, restyle, recolour, simplify, shorten, lengthen, add, or remove any detail. If several images are attached they are views of the SAME garment (e.g. front and back) — use them together for accuracy.";

/**
 * Photo-based modes — the one permitted change to the garment itself. Real
 * source photos (mannequin, old catalogue, phone snaps) are rarely pressed.
 */
const PRESS_LINE =
  "GARMENT PRESSING (mandatory): show the garment professionally steam-pressed, exactly as a stylist prepares it for a luxury campaign shoot — zero wrinkles, creases, crumples, fold lines or packing marks anywhere on the shirt, sleeves, trousers or dupatta; crisp clean seams, smooth flat panels and a clean straight hem. Only the soft natural folds real fabric forms where the body bends may remain. Keep the fabric's true texture, weave and natural drape (not stiff, not plastic, not glossy). Pressing must not alter any design detail.";

/**
 * Mannequin first pass — copy the source shot's stance and framing so the
 * only visible changes are the model, the pressing, and the backdrop. Other
 * poses come later via Refine (or an explicit pose pick).
 */
const MATCH_SOURCE_POSE_LINE =
  "Pose and framing: match the source photo exactly — same front-facing standing stance, same camera height, angle, and distance, same full-length framing and crop, garment facing the camera as on the mannequin. Arms rest naturally at the sides as a real person stands (adapt a mannequin's rigid arms, or a hanger/flat-lay shape, naturally onto the body), feet together or slightly apart. Calm, straight, catalogue stance — no turn, no lean, no walking.";

/**
 * Portrait / detail poses: the garment-lock wording ("reproduce the hem…")
 * otherwise makes the model zoom back out to show the whole outfit.
 */
const CROPPED_FRAMING_LINE =
  "FRAMING: this is a cropped close shot — frame it exactly as described (waist-up, chest-up or detail). It is correct and expected that the lower garment, hem and feet fall outside the frame; do not zoom out to show the full outfit. Every garment detail that IS in frame must match the reference exactly.";

/** Detail poses: a true macro of the craft, not a portrait. */
const DETAIL_FRAMING_LINE =
  "FRAMING: tight detail photograph — fill the frame with the named garment area (embroidery panel, neckline, sleeve cuff or hem) at close range, like a luxury macro product shot. The face is out of frame (at most the chin at the very top edge). Thread texture, stitch direction, zari/metallic sheen and fabric weave must be crisp and exact. It is correct that most of the garment and the model fall outside the frame.";

const CAMERA_CROPPED =
  "Shot like a real commercial fashion campaign close-up: 85–105mm portrait lens look, shallow depth of field, sharp focus on the face, neckline and embroidery, true-to-life fabric texture, modest tasteful styling.";

const CAMERA_MATCH_SOURCE =
  "Shot like a real professional catalogue photograph: 50–85mm lens look, sharp focus on the garment, true-to-life fabric texture, colour and drape, modest tasteful styling.";

/** Mannequin mode — no trace of the display rig may survive. */
const MANNEQUIN_CLEANUP =
  "Remove the mannequin, dress form, stand, base, hanger, pins, clips, flat-lay surface, price tags and labels entirely — none of them may appear. The garment must sit naturally on a real human body with real arms, hands, neck, and face.";

/** Most garment reference photos sent with one request (plus the base image on refine). */
export const MAX_GARMENT_REFERENCES = 6;

/**
 * Several photos of one garment (angles, distances, embroidery close-ups):
 * read them together, close-ups win on detail.
 */
function multiReferenceLine(count: number): string {
  return `GARMENT REFERENCES: ${count} reference photos of the SAME garment are attached — the first is the main full view; the others show other angles, distances, close-ups and embroidery details. Treat them together as the single source of truth and reproduce every detail exactly as it appears across them: embroidery motifs, thread colours, stitch density and exact placement, borders, lace, buttons, print scale, fabric texture and sheen. Where a close-up shows more detail than a full view, follow the close-up. Never invent, simplify, move or omit embroidery.`;
}

/**
 * Refine: the base render comes first, the original garment photos after it.
 * Pose/setting edits must re-read the garment from the originals so nothing
 * drifts across versions.
 */
function refineReferenceLine(count: number): string {
  const refs =
    count === 1 ? "The second image is" : `The remaining ${count} images are`;
  return `EDIT REFERENCES: the FIRST attached image is the previous photograph — use it only for the model and for whatever is not being changed. ${refs} the ORIGINAL garment reference photo${count === 1 ? "" : "s"}: the garment in the result must match ${count === 1 ? "it" : "them"} exactly — embroidery, colours, cut and every detail — even where the previous photograph drifted. A pose or background change never changes the garment.`;
}

/** Text-only — invent garment from the user's description. */
const DESCRIPTION_ANCHOR =
  "Photorealistic fashion photograph that looks like a real commercial campaign shot. Create the outfit from the user's written description only — no sketch or reference photo. Invent a coherent modest South Asian / Pakistani women's outfit (e.g. kameez, shalwar/palazzo, dupatta if mentioned) that matches the colours, fabric, and style notes. Show it on the house model in a varied commercial pose (not always standing front-on).";

/** Strip junk that often appears in sourced photos / screenshots. */
const CLEANUP =
  "Include ONLY the model and the clothing. Completely omit anything irrelevant that is not part of the dress: watermarks, logos, brand marks, arrows, crosses, religious or UI symbols, circles, stickers, text overlays, phone UI, screenshots chrome, collages, and background clutter from the source image.";

/**
 * Default scene: real photography, dress-compatible — not a flat seamless studio.
 * User feedback about background can override via the variable block.
 */
const REAL_SCENE =
  "Place the model in a believable real-world photography setting that complements the dress colour, fabric, and occasion (for example soft outdoor daylight courtyard, marble foyer, boutique interior, garden path, or warm evening terrace). Natural depth, real surfaces, and realistic lighting — not a flat seamless paper backdrop, not CGI, not illustration.";

const CAMERA =
  "Shot like a real commercial fashion campaign: 50–85mm lens look, natural depth of field, sharp focus on the garment, true-to-life fabric texture and drape, modest tasteful styling. Framing may be full-length or three-quarter depending on the pose — never a stiff mannequin stand unless that pose is requested.";

/** Avoid blank “AI mannequin” faces — a real, warm, confident expression. */
const EXPRESSION =
  "Expression: a warm, genuine, confident smile that reaches the eyes (closed-mouth or a soft natural smile with a hint of teeth), eyes alive and engaged with the camera unless the pose looks away, relaxed brows and natural micro-expression — the look of a professional model enjoying the shoot. Not blank, vacant, deadpan, frozen, or mannequin-like; modest and tasteful, no exaggerated grin.";

/** Hair, make-up and finish — what separates a brand campaign from a snapshot. */
const STYLING =
  "Styling: polished natural make-up (even luminous skin with real texture, softly defined brows and eyes, nude-rose lips), well-groomed glossy hair styled to suit the outfit (soft waves, sleek low bun, or neat braid), minimal fine jewellery such as small gold or pearl studs, neat natural nails, graceful upright posture and elegant relaxed hands.";

const STYLE =
  "Luxury modest fashion campaign photography of the standard a high-end designer label publishes, in a minimalist-luxury editorial direction — natural light, calm neutral tones, refined understated styling, the garment always leading: photorealistic, shot on a full-frame camera by a professional fashion photographer, flattering soft key light with gentle fill, refined natural colour grading with true-to-life garment colour, clean professional retouching that keeps real skin texture. Not illustrated, not CGI, not a stiff e-commerce ghost mannequin.";

const SHARED_NEGATIVES =
  "watermark, text overlay, logo, arrow, cross symbol, UI icons, screenshot chrome, collage, wrinkled fabric, creased fabric, crumpled cloth, blank stare, deadpan face, emotionless expression, vacant eyes, mannequin face, stiff military stand, identical pose every time, uncanny valley, deformed hands, extra limbs, illustrated, cartoon, CGI, plastic skin";

export const DEFAULT_NEGATIVE_PROMPT =
  `no altered neckline or hem, no distorted embroidery, no oversaturation, no extra garments, ${SHARED_NEGATIVES}`;

export const OLD_DESIGN_NEGATIVE_PROMPT =
  `same face as reference photo, original model identity, photocopy of input, identical pose to reference, ${SHARED_NEGATIVES}`;

export const MANNEQUIN_NEGATIVE_PROMPT =
  `turned away, back to camera, fold lines, packing marks, mannequin, dress form, mannequin stand, plastic body, headless figure, pins, price tag, altered dress, redesigned garment, new embroidery, missing embroidery, simplified embroidery, colour shift, different print, different hem, different neckline, different sleeves, different silhouette, ${SHARED_NEGATIVES}`;

export const REPOSE_NEGATIVE_PROMPT =
  `altered dress, redesigned garment, new embroidery, colour shift, different hem, different neckline, different silhouette, same face as reference photo, original model identity, photocopy of input, identical pose to reference, ${SHARED_NEGATIVES}`;

export type PromptMode =
  | "sketch"
  | "old-design"
  | "description"
  | "repose"
  | "mannequin";

export const INPUT_SOURCE_TABS = [
  {
    id: "sketch" as const,
    label: "1 · Sketch",
    hint: "Turn a drawing into a real photo",
  },
  {
    id: "old-design" as const,
    label: "2 · Restyle a photo",
    hint: "Use a photo as inspiration — the look may be improved",
  },
  {
    id: "description" as const,
    label: "3 · Description",
    hint: "Describe it in words — no upload",
  },
] as const;

/** One-click pose / angle presets for the result screen — full commercial library. */
export const POSE_PRESETS = COMMERCIAL_POSES.map((pose) => ({
  id: pose.id,
  label: pose.label,
  feedback: `${pose.prompt} Keep the same house model and the same dress — only pose/camera may change.`,
}));

export type PromptBuilderInput = {
  description?: string;
  shirtColour?: string;
  shirtFabric?: string;
  trouserColour?: string;
  trouserFabric?: string;
  fabric?: string;
  feedback?: string;
  persona?: Partial<ModelPersona>;
  mode?: PromptMode;
  /**
   * Generate: pass a chosen commercial pose (or omit to auto-pick).
   * Refine: omit + set keepPose to lock the previous stance.
   */
  pose?: CommercialPose | null;
  poseId?: string | null;
  /** On refine, keep previous pose unless feedback asks for a pose change. */
  keepPose?: boolean;
  /** Explicit scene / background prompt (from studio presets or custom). */
  backgroundPrompt?: string | null;
  /** How many original garment photos are attached (garment-locked modes). */
  garmentReferenceCount?: number;
  /** Refine call: the previous render is attached first, references after. */
  refine?: boolean;
};

export type BuiltPrompt = {
  prompt: string;
  negativePrompt: string;
  seed: number | undefined;
  mode: PromptMode;
  poseId?: string;
  poseLabel?: string;
};

function trimOrEmpty(value?: string | null): string {
  return value?.trim() ?? "";
}

function joinNonEmpty(
  parts: Array<string | null | undefined | false>,
  separator = " ",
): string {
  return parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(separator);
}

export function feedbackRequestsBackground(feedback?: string): boolean {
  return /\b(background|backdrop|setting|scene|location|environment|outdoor|indoor|garden|street|studio|terrace|courtyard|foyer)\b/i.test(
    feedback ?? "",
  );
}

export function feedbackRequestsPose(feedback?: string): boolean {
  return /\b(pose|angle|side|profile|front|three[- ]?quarter|walking|walk|over[- ]?shoulder|turn|facing|camera|sit|sitting|seated|lean|leaning|crouch|kneel|stairs|step)\b/i.test(
    feedback ?? "",
  );
}

function buildGarmentNotes(input: PromptBuilderInput): string {
  const fabricFallback = trimOrEmpty(input.fabric);
  const shirtColour = trimOrEmpty(input.shirtColour);
  const shirtFabric = trimOrEmpty(input.shirtFabric) || fabricFallback;
  const trouserColour = trimOrEmpty(input.trouserColour);
  const trouserFabric = trimOrEmpty(input.trouserFabric) || fabricFallback;

  const notes: string[] = [];

  if (shirtColour || shirtFabric) {
    notes.push(
      `${joinNonEmpty([
        "Shirt/kameez:",
        shirtColour && `${shirtColour} colour`,
        shirtFabric && `${shirtFabric} fabric`,
      ])}.`,
    );
  }

  if (trouserColour || trouserFabric) {
    notes.push(
      `${joinNonEmpty([
        "Trousers/shalwar:",
        trouserColour && `${trouserColour} colour`,
        trouserFabric && `${trouserFabric} fabric`,
      ])}.`,
    );
  }

  if (!notes.length && fabricFallback) {
    notes.push(`Fabric: ${fabricFallback}.`);
  }

  return notes.join(" ");
}

/**
 * Assembles the fal prompt.
 * Sketch mode: structure wins. Old-design mode: garment idea + new house model.
 */
export function buildPrompt(input: PromptBuilderInput = {}): BuiltPrompt {
  const mode: PromptMode =
    input.mode === "old-design"
      ? "old-design"
      : input.mode === "description"
        ? "description"
        : input.mode === "repose"
          ? "repose"
          : input.mode === "mannequin"
            ? "mannequin"
            : "sketch";
  /** Modes where the source garment is locked and only the shot changes. */
  const garmentLocked = mode === "repose" || mode === "mannequin";
  const persona = getModelPersona(input.persona);
  const description = trimOrEmpty(input.description);
  const feedback = trimOrEmpty(input.feedback);
  const garmentNotes = buildGarmentNotes(input);
  const wantsBg = feedbackRequestsBackground(feedback);
  const wantsPose = feedbackRequestsPose(feedback);

  let pose: CommercialPose | undefined =
    input.pose ?? getCommercialPoseById(input.poseId) ?? undefined;
  let keepPose = Boolean(input.keepPose);

  /** Mannequin first pass with no pose picked: copy the source's stance. */
  const matchSourcePose =
    mode === "mannequin" && !pose && !keepPose && !wantsPose;

  if (wantsPose) {
    keepPose = false;
    pose = undefined;
  } else if (!pose && !keepPose && !matchSourcePose) {
    pose = pickRandomCommercialPose();
  }

  const variableBlock = joinNonEmpty(
    [
      description &&
        (mode === "description"
          ? `Garment brief: ${description}.`
          : mode === "repose"
            ? `Pose / camera note only (do not change the dress): ${description}.`
            : mode === "mannequin"
              ? `Styling / shot note (the dress itself must not change): ${description}.`
              : `User direction: ${description}.`),
      mode === "repose"
        ? null
        : mode === "mannequin" && garmentNotes
          ? `Colour reference to reproduce accurately (do not recolour): ${garmentNotes}`
          : garmentNotes,
      feedback &&
        (wantsBg
          ? `BACKGROUND CHANGE — apply clearly, replace the entire environment with a real photographic setting: ${feedback}. Keep the same house model and the same dress.`
          : wantsPose
            ? `POSE / ANGLE CHANGE — apply clearly with a new real commercial fashion-photography stance: ${feedback}. Keep the same house model and the same dress; do not return a near-copy of the previous frame.`
            : garmentLocked
              ? `Apply this change to the photograph only; keep the dress identical and pressed: ${feedback}.`
              : mode === "old-design" || mode === "description"
                ? `Apply this change clearly (do not return a near-copy): ${feedback}.`
                : `Refinement: ${feedback}.`),
    ],
    " ",
  );

  const modelLine =
    mode === "mannequin"
      ? `House model (MUST use this exact distinct real person, wearing the garment from the source photo): ${persona.description}`
      : mode === "old-design" || mode === "repose"
      ? `House model (MUST use this exact distinct person — not anyone from the reference photo, and not a generic similar face): ${persona.description}`
      : `House model (keep this exact distinct identity — do not genericise into a lookalike): ${persona.description}`;

  const sceneLine = wantsBg
    ? "The new background must look like a real photograph, compatible with the dress colour and occasion, with natural depth and lighting."
    : trimOrEmpty(input.backgroundPrompt) || REAL_SCENE;

  // On a refine the image editor tends to return a near-copy of the first
  // image, so an explicitly picked pose must be phrased as a re-shoot.
  const poseLine = wantsPose
    ? null
    : keepPose
      ? KEEP_POSE_LINE
      : matchSourcePose
        ? MATCH_SOURCE_POSE_LINE
        : pose && input.refine
          ? `POSE / FRAMING CHANGE — re-photograph the same model in the same garment with a clearly different pose and framing, as a new frame from the same shoot; do not return a near-copy of the first image. ${pose.prompt}`
          : pose?.prompt ?? null;

  const croppedShot =
    !wantsPose &&
    !keepPose &&
    (pose?.category === "Portrait" || pose?.category === "Detail");

  const referenceCount = garmentLocked
    ? Math.max(0, Math.floor(input.garmentReferenceCount ?? 0))
    : 0;
  const referenceLines = [
    ...(input.refine && referenceCount > 0
      ? [refineReferenceLine(referenceCount)]
      : []),
    ...(referenceCount > 1 ? [multiReferenceLine(referenceCount)] : []),
  ];

  const anchor =
    mode === "old-design"
      ? OLD_DESIGN_ANCHOR
      : mode === "repose"
        ? REPOSE_ANCHOR
        : mode === "mannequin"
          ? MANNEQUIN_ANCHOR
          : mode === "description"
          ? DESCRIPTION_ANCHOR
          : SKETCH_ANCHOR;

  const prompt = joinNonEmpty(
    [
      anchor,
      ...referenceLines,
      ...(mode === "mannequin" ? [PRESS_LINE, MANNEQUIN_CLEANUP] : []),
      ...(mode === "repose" || mode === "old-design" ? [PRESS_LINE] : []),
      ...(mode === "description" ? [] : [CLEANUP]),
      modelLine,
      variableBlock,
      sceneLine,
      ...(poseLine ? [poseLine] : []),
      ...(croppedShot
        ? [pose?.category === "Detail" ? DETAIL_FRAMING_LINE : CROPPED_FRAMING_LINE]
        : []),
      EXPRESSION,
      STYLING,
      matchSourcePose
        ? CAMERA_MATCH_SOURCE
        : croppedShot
          ? CAMERA_CROPPED
          : CAMERA,
      STYLE,
      ...(garmentLocked
        ? [
            "GARMENT LOCK: if pose or model conflicts with the dress, keep the dress and adjust pose only.",
          ]
        : []),
    ],
    " ",
  );

  return {
    prompt,
    negativePrompt:
      mode === "old-design"
        ? OLD_DESIGN_NEGATIVE_PROMPT
        : mode === "repose"
          ? REPOSE_NEGATIVE_PROMPT
          : mode === "mannequin"
            ? MANNEQUIN_NEGATIVE_PROMPT
            : DEFAULT_NEGATIVE_PROMPT,
    seed: resolvePersonaSeed(persona),
    mode,
    poseId: pose?.id,
    poseLabel: pose?.label,
  };
}

/** Resolve mode from client tab or from what was uploaded. */
export function resolvePromptMode(input: {
  sketchUrls?: string[] | null;
  oldDesignUrl?: string | null;
  oldDesignUrls?: string[] | null;
  sourceMode?: PromptMode | null;
  hasDescription?: boolean;
}): PromptMode {
  if (
    input.sourceMode === "sketch" ||
    input.sourceMode === "old-design" ||
    input.sourceMode === "description" ||
    input.sourceMode === "repose" ||
    input.sourceMode === "mannequin"
  ) {
    return input.sourceMode;
  }
  const hasSketch = Boolean(input.sketchUrls?.some((u) => u?.trim()));
  const hasOld = Boolean(
    input.oldDesignUrl?.trim() ||
      input.oldDesignUrls?.some((u) => u?.trim()),
  );
  if (hasOld && !hasSketch) return "old-design";
  if (!hasSketch && !hasOld && input.hasDescription) return "description";
  return "sketch";
}

/**
 * Saved designs don't store their mode; recover it from the first version's
 * prompt, which always opens with the mode's anchor. Null when unknown.
 */
export function promptModeFromSavedPrompt(
  prompt: string | null | undefined,
): PromptMode | null {
  const text = prompt ?? "";
  const anchors: Array<[string, PromptMode]> = [
    [MANNEQUIN_ANCHOR, "mannequin"],
    [REPOSE_ANCHOR, "repose"],
    [OLD_DESIGN_ANCHOR, "old-design"],
    [DESCRIPTION_ANCHOR, "description"],
    [SKETCH_ANCHOR, "sketch"],
  ];
  for (const [anchor, mode] of anchors) {
    if (text.startsWith(anchor.slice(0, 160))) return mode;
  }
  return null;
}
