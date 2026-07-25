export type GenerationResult = {
  imageUrl: string;
  /** USD micro-dollars (1 USD = 1_000_000). Never floats. */
  costUsdMicros: number;
  latencyMs: number;
  seed?: number;
  hasNsfw?: boolean;
};

export type ModerationResult = {
  safe: boolean;
  reason?: string;
};

export type SketchToGarmentInput = {
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  imageUrl: string;
  seed?: number;
  strength?: number;
};

export type RecolourInput = {
  modelId: string;
  prompt: string;
  imageUrl: string;
  seed?: number;
};

export type ModerationInput = {
  imageUrl: string;
};

export interface ImageGenProvider {
  sketchToGarment(input: SketchToGarmentInput): Promise<GenerationResult>;
  recolour(input: RecolourInput): Promise<GenerationResult>;
  moderate(input: ModerationInput): Promise<ModerationResult>;
}
