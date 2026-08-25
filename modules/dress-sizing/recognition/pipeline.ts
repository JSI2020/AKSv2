import type { VisionAdapter } from "./adapter";
import { createFalVisionAdapter, falKey } from "../providers/fal";
import { createDeepseekVisionAdapter, deepseekKey, repairRecognitionJson } from "../providers/deepseek";

export const recognitionConfigured = () => Boolean(falKey() || deepseekKey());

export function createRecognitionAdapter(): VisionAdapter {
  return {
    async complete(imageUrl, prompt) {
      let notes = "";
      let error: unknown;
      if (falKey()) {
        try { notes = await createFalVisionAdapter().complete(imageUrl, prompt); } catch (cause) { error = cause; }
      }
      if (!notes && deepseekKey()) {
        try { notes = await createDeepseekVisionAdapter().complete(imageUrl, prompt); } catch (cause) { error = cause; }
      }
      if (!notes) throw new Error(error instanceof Error ? error.message : "No vision provider is configured.");
      if (!deepseekKey()) return notes;
      return repairRecognitionJson(`${prompt}\n\nVision notes:\n${notes}`).catch(() => notes);
    },
  };
}
