import { uuidv7 } from "@aks/shared";
import type { Database } from "@/packages/db";
import { dressRecognitionProposal } from "@/packages/db/schema";
import { GARMENT_RECOGNITION_PROMPT, type VisionAdapter } from "./adapter";
import { FALLBACK_RECOGNITION, parseRecognitionOutput, type RecognitionOutput } from "./schema";

export type RecognizeResult = RecognitionOutput & {
  proposalId: string; lowConfidence: boolean; valid: boolean; status: "proposed";
};

function parseText(text: string): unknown {
  const candidate = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text.trim();
  try { return JSON.parse(candidate); } catch { return { rawText: text }; }
}

export async function recognizeGarment(db: Database, imageUrl: string, adapter: VisionAdapter): Promise<RecognizeResult> {
  let raw: unknown;
  try { raw = parseText(await adapter.complete(imageUrl, GARMENT_RECOGNITION_PROMPT)); }
  catch (error) { raw = { error: error instanceof Error ? error.message : "adapter_failed" }; }
  const parsed = parseRecognitionOutput(raw);
  const output = parsed.valid ? parsed.output : FALLBACK_RECOGNITION;
  const id = uuidv7();
  await db.insert(dressRecognitionProposal).values({
    id, imageUrl, templateKey: output.templateKey, lengthBand: output.lengthBand,
    fitIntent: output.fitIntent, confidence: output.confidence,
    rawJson: { raw, points: output.points ?? null, lowConfidence: parsed.lowConfidence, valid: parsed.valid },
    status: "proposed",
  });
  return { proposalId: id, ...output, lowConfidence: parsed.lowConfidence, valid: parsed.valid, status: "proposed" };
}
