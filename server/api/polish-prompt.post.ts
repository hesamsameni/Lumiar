import { createOpenRouterClient } from "../utils/providers";

const SYSTEM_PROMPT = `You are an AI image prompt optimizer.

Rewrite the user's prompt into a concise, high-quality prompt for image generation models like Nano Banana and GPT-image-2.

Rules:
- Preserve the original intent and subject
- Enhance with relevant visual details only when useful
- Improve clarity, composition, lighting, style, and mood
- Use short, dense prompt-style wording
- Avoid explanations, lists, quotes, markdown, or conversational text
- Do not invent unrelated elements
- Maximum 80 words
- Output ONLY the final prompt`;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  await requireUser(event);

  const { prompt } = await readBody(event);

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw createError({ statusCode: 400, message: "No prompt provided" });
  }
  if (prompt.length > 2000) {
    throw createError({ statusCode: 400, message: "Prompt is too long" });
  }

  const client = createOpenRouterClient(config.openrouterApiKey as string);
  const response = await client.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt.trim() },
    ],
  });

  return { polished: response.choices[0]?.message?.content ?? prompt };
});
