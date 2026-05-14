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
        content: `You are an expert AI image generation prompt engineer. Your job is to take a user's rough prompt and rewrite it to be much more effective for AI image generation models like Flux and DALL-E. 

Rules:
- Keep the core idea intact
- Add specific details about lighting, style, composition, mood, color palette
- Suggest relevant technical keywords (e.g. "8k", "photorealistic", "volumetric lighting")
- Keep it under 200 words
- Return ONLY the improved prompt, no explanation or preamble`,
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
