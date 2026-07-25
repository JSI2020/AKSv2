export type TryOnPersonaliseInput = {
  modelId: string;
  /** Frozen garment render — face swap target. */
  targetImageUrl: string;
  /** Customer selfie — source face. */
  faceImageUrl: string;
  gender?: "male" | "female" | "non_binary";
};

export type TryOnPersonaliseResult = {
  imageUrl: string;
  /** USD micro-dollars — never floats. */
  costUsdMicros: number;
  latencyMs: number;
};

export interface TryOnProvider {
  personalise(input: TryOnPersonaliseInput): Promise<TryOnPersonaliseResult>;
}

export type SelfieValidationErrorKind =
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "LOW_RESOLUTION"
  | "BLURRY"
  | "NSFW"
  | "INVALID_IMAGE";

export type SelfieValidationResult =
  | { ok: true; faceEmbeddingRef: string }
  | { ok: false; kind: SelfieValidationErrorKind; message: string };

export const TRYON_GALLERY_ANGLES = ["FRONT", "THREE_QUARTER", "BACK"] as const;
export type TryOnGalleryAngle = (typeof TRYON_GALLERY_ANGLES)[number];

export const TRYON_CONSENT_VERSION = 1;

export const TRYON_CONSENT_COPY = {
  title: "Reflection — try it on",
  body: [
    "Your photo is used only to personalise these garment renders with your face.",
    "The original selfie is deleted within 24 hours.",
    "We never use your photo to train AI models.",
    "You can revoke consent at any time from your account.",
  ],
  attestation: "This photo is of me.",
  checkbox: "I consent to Reflection using my photo as described above.",
} as const;

export const TRYON_UNAVAILABLE_MESSAGE =
  "Reflection is resting — back shortly.";

/** Verified fal endpoint — https://fal.ai/models/easel-ai/advanced-face-swap */
export const VERIFIED_FAL_TRYON_MODEL = "easel-ai/advanced-face-swap";

/** Estimated cost per angle in USD micro-dollars. */
export const ESTIMATED_TRYON_COST_USD_MICROS = 50_000;

export const SELFIE_PURGE_HOURS = 24;
export const SELFIE_MIN_EDGE_PX = 512;

export function buildTryOnCacheKey(input: {
  faceEmbeddingRef: string;
  designId: string;
  colourwayId: string;
  archetypeId: string | null;
}): string {
  return [
    input.faceEmbeddingRef,
    input.designId,
    input.colourwayId,
    input.archetypeId ?? "none",
  ].join(":");
}
