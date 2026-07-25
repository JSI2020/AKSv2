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

/** Placeholder for a cheap LLM — wire when OPENAI_API_KEY or similar is available. */
export class LlmPromptModifier implements PromptModifierAdapter {
  readonly name = "llm";

  constructor(private readonly apiKey: string) {}

  async apply(input: PromptModifierInput): Promise<PromptModifications> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Convert designer revision notes into concise prompt modifications for fashion image generation. Return JSON: {\"deltas\": string[], \"resolvedPrompt\": string}. The resolvedPrompt must be the full final prompt including the base prompt plus your modifications. Never return only the notes.",
          },
          {
            role: "user",
            content: JSON.stringify({
              basePrompt: input.basePrompt,
              notes: input.notes,
            }),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM prompt modifier failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new Error("LLM prompt modifier returned empty content");

    const parsed = JSON.parse(raw) as {
      deltas?: string[];
      resolvedPrompt?: string;
    };
    const resolvedPrompt = parsed.resolvedPrompt?.trim();
    if (!resolvedPrompt) {
      throw new Error("LLM prompt modifier missing resolvedPrompt");
    }

    return {
      resolvedPrompt,
      deltas: parsed.deltas ?? [],
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
