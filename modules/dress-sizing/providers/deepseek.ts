import type { VisionAdapter } from "../recognition/adapter";

export const deepseekKey = () => process.env.DEEPSEEK_API_KEY?.trim() ?? "";
const baseUrl = () => process.env.DEEPSEEK_BASE_URL?.trim().replace(/\/$/, "") || "https://api.deepseek.com";

async function chat(model: string, messages: Array<{ role: "system" | "user"; content: string | Array<Record<string, unknown>> }>) {
  const key = deepseekKey();
  if (!key) throw new Error("DEEPSEEK_API_KEY is not configured.");
  const response = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages }),
  });
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek returned an empty response.");
  return text;
}

export function createDeepseekVisionAdapter(): VisionAdapter {
  return {
    complete(imageUrl, prompt) {
      return chat(process.env.DEEPSEEK_VISION_MODEL?.trim() || "deepseek-v4-flash-vision-exp", [{
        role: "user",
        content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl } }],
      }]);
    },
  };
}

export function repairRecognitionJson(notes: string): Promise<string> {
  return chat(process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat", [
    { role: "system", content: "Return valid JSON only using the garment schema enums supplied in the notes." },
    { role: "user", content: notes },
  ]);
}
