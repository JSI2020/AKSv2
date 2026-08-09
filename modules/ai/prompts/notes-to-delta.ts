/**
 * Notes → structured prompt modifications.
 *
 * When no LLM API key is configured, `HeuristicPromptModifier` appends a
 * deterministic "Revision notes" block so reproducibility survives without
 * an external call. Plug in `LlmPromptModifier` later via `PromptModifierAdapter`.
 */

export type PromptModifications = {
  /** Full resolved prompt — never store raw designer notes alone. */
  resolvedPrompt: string;
  /** Optional structured deltas applied (for audit / debugging). */
  deltas: string[];
  /** Which adapter produced this result. */
  source: "heuristic" | "llm";
};

export type PromptModifierInput = {
  basePrompt: string;
  notes: string;
};

export interface PromptModifierAdapter {
  readonly name: string;
  apply(input: PromptModifierInput): Promise<PromptModifications>;
}

function normalizeNotes(notes: string): string[] {
  return notes
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Deterministic fallback — no API key required.
 * Appends structured revision lines so the stored prompt is self-contained.
 */
export class HeuristicPromptModifier implements PromptModifierAdapter {
  readonly name = "heuristic";

  async apply(input: PromptModifierInput): Promise<PromptModifications> {
    const notes = input.notes.trim();
    if (!notes) {
      return {
        resolvedPrompt: input.basePrompt,
        deltas: [],
        source: "heuristic",
      };
    }

    const fragments = normalizeNotes(notes);
    const deltas = fragments.map((f) => `Adjust: ${f}.`);
    const revisionBlock = `Revision notes: ${deltas.join(" ")}`;
    const resolvedPrompt = `${input.basePrompt.trim()} ${revisionBlock}`.trim();

    return { resolvedPrompt, deltas, source: "heuristic" };
  }
}

/** Uses OpenAI via providers/ when OPENAI_API_KEY (or AI_PROMPT_MODIFIER_KEY) is set. */
export class LlmPromptModifier implements PromptModifierAdapter {
  readonly name = "llm";

  constructor(private readonly apiKey: string) {}

  async apply(input: PromptModifierInput): Promise<PromptModifications> {
    const { modifyPromptWithOpenAi } = await import(
      "@/modules/ai/providers/openai-prompt"
    );
    const result = await modifyPromptWithOpenAi({
      apiKey: this.apiKey,
      basePrompt: input.basePrompt,
      notes: input.notes,
    });
    return {
      resolvedPrompt: result.resolvedPrompt,
      deltas: result.deltas,
      source: "llm",
    };
  }
}

export function resolvePromptModifier(): PromptModifierAdapter {
  const key =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.AI_PROMPT_MODIFIER_KEY?.trim();
  if (key) return new LlmPromptModifier(key);
  return new HeuristicPromptModifier();
}

export async function applyNotesToPrompt(
  input: PromptModifierInput,
  adapter?: PromptModifierAdapter,
): Promise<PromptModifications> {
  const mod = adapter ?? resolvePromptModifier();
  return mod.apply(input);
}
