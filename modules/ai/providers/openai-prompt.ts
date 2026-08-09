/**
 * OpenAI adapter for notes → prompt modifications.
 * Vendor HTTP stays in providers/ — never import OpenAI elsewhere.
 */
export type OpenAiPromptModification = {
  resolvedPrompt: string;
  deltas: string[];
};

export async function modifyPromptWithOpenAi(input: {
  apiKey: string;
  basePrompt: string;
  notes: string;
}): Promise<OpenAiPromptModification> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            'Convert designer revision notes into concise prompt modifications for fashion image generation. Return JSON: {"deltas": string[], "resolvedPrompt": string}. The resolvedPrompt must be the full final prompt including the base prompt plus your modifications. Never return only the notes.',
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
  };
}
