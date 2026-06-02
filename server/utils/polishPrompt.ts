import { createOpenRouterClient } from "./providers";

const DEFAULT_MODEL = "openai/gpt-4o-mini";

const POLISH_SYSTEM_PROMPT = `You are an AI image prompt optimizer.

Rewrite the user's prompt into a concise, high-quality prompt for image generation models like Nano Banana and GPT-image-2.

Rules:
- Preserve the original intent and subject
- Enhance with relevant visual details only when useful
- Improve clarity, composition, lighting, style, and mood
- Use short, dense prompt-style wording
- Avoid explanations, lists, quotes, markdown, or conversational text
- Do not invent unrelated elements
- Maximum 150 words
- Output ONLY the final prompt`;

const CONDENSE_SYSTEM_PROMPT = `You are an AI image prompt summarizer that preserves every requirement in the user's prompt.

Rewrite the prompt so that it remains faithful to the requested subject, style, mood, inputs, and any constraints. Remove repetition and fluff, keeping all explicit requirements intact. Output text only, without quotes or markup, and ensure the final prompt is no longer than 2000 characters.`;

async function runPromptEdit(
  prompt: string,
  apiKey: string,
  systemPrompt: string,
) {
  const client = createOpenRouterClient(apiKey);
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt.trim() },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? prompt.trim();
}

export async function polishPrompt(prompt: string, apiKey: string) {
  return runPromptEdit(prompt, apiKey, POLISH_SYSTEM_PROMPT);
}

export async function condensePrompt(prompt: string, apiKey: string) {
  return runPromptEdit(prompt, apiKey, CONDENSE_SYSTEM_PROMPT);
}
