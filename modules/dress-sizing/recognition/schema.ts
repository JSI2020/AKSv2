import { z } from "zod";
import { FIT_INTENTS, GARMENT_TYPES, LENGTH_BANDS } from "../db/enums";
import {
  HEM_FULLNESS, HEM_LANDMARKS, NECK_DROPS, NECK_SHAPES,
  SHOULDER_WIDTHS, SLEEVE_STYLES,
} from "../core/style-points";

const fit = z.enum(FIT_INTENTS);
export const stylePointsSchema = z.object({
  hem: z.object({ landmark: z.enum(HEM_LANDMARKS).optional(), fullness: z.enum(HEM_FULLNESS).optional() }).optional(),
  neck: z.object({ shape: z.enum(NECK_SHAPES).optional(), drop: z.enum(NECK_DROPS).optional() }).optional(),
  sleeve: z.object({ style: z.enum(SLEEVE_STYLES).optional() }).optional(),
  chest: z.object({ fit: fit.optional() }).optional(),
  waist: z.object({ fit: fit.optional() }).optional(),
  hip: z.object({ fit: fit.optional() }).optional(),
  shoulder: z.object({ width: z.enum(SHOULDER_WIDTHS).optional() }).optional(),
}).optional();

export const recognitionOutputSchema = z.object({
  templateKey: z.enum(GARMENT_TYPES),
  lengthBand: z.enum(LENGTH_BANDS),
  fitIntent: fit,
  confidence: z.number().min(0).max(1),
  points: stylePointsSchema,
});
export type RecognitionOutput = z.infer<typeof recognitionOutputSchema>;
export const FALLBACK_RECOGNITION: RecognitionOutput = {
  templateKey: "kurti", lengthBand: "knee", fitIntent: "semi_fitted", confidence: 0,
};

export function parseRecognitionOutput(raw: unknown) {
  const parsed = recognitionOutputSchema.safeParse(raw);
  return parsed.success
    ? { output: parsed.data, lowConfidence: parsed.data.confidence < 0.6, valid: true }
    : { output: FALLBACK_RECOGNITION, lowConfidence: true, valid: false };
}

export function stylePointsFromRawJson(raw: unknown) {
  if (!raw || typeof raw !== "object") return undefined;
  const parsed = stylePointsSchema.safeParse((raw as { points?: unknown }).points);
  return parsed.success ? parsed.data : undefined;
}
