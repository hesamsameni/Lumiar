import OpenAI from "openai";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  // requireUser is auto-imported from server/utils/auth.ts
  await requireUser(event);

  const { prompt } = await readBody(event);

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw createError({ statusCode: 400, message: "No prompt provided" });
  }

  if (prompt.length > 2000) {
    throw createError({ statusCode: 400, message: "Prompt is too long" });
  }

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: config.openrouterApiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://lumiar.app",
      "X-Title": "Lumiar",
    },
  });

  const response = await client.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an AI image prompt optimizer.

Rewrite the user's prompt into a concise, high-quality prompt for image generation models like Nano Banana and GPT-image-2.

Rules:
- Preserve the original intent and subject
- Enhance with relevant visual details only when useful
- Improve clarity, composition, lighting, style, and mood
- Use short, dense prompt-style wording
- Avoid explanations, lists, quotes, markdown, or conversational text
- Do not invent unrelated elements
- Maximum 80 words
- Output ONLY the final prompt`,
      },
      {
        role: "user",
        content: prompt.trim(),
      },
    ],
  });

  const polished = response.choices[0]?.message?.content ?? prompt;

  return { polished };
});
