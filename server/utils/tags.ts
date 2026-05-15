export const AVAILABLE_TAGS = [
  "portrait",
  "landscape",
  "abstract",
  "anime",
  "photorealistic",
  "concept art",
  "illustration",
  "logo",
  "architecture",
  "nature",
  "fantasy",
  "sci-fi",
  "vintage",
  "minimalist",
  "surreal",
  "product",
  "food",
  "fashion",
  "interior",
  "dark art",
] as const;

/**
 * Uses a cheap OpenRouter model to infer 1-4 relevant tags for a prompt.
 * Returns an empty array on any error — never throws.
 */
export async function inferTagsFromPrompt(
  apiKey: string,
  prompt: string,
): Promise<string[]> {
  try {
    const tagList = AVAILABLE_TAGS.join(", ");
    const systemMessage = `You are a tagging assistant for an AI image gallery. Given an image generation prompt, pick 1-4 tags that best describe the image. You MUST choose ONLY from these exact tags (copy them exactly as written): ${tagList}. Return ONLY a JSON array of strings, e.g. ["portrait", "fantasy"]. No markdown, no explanation.`;

    const res = await $fetch<{
      choices: Array<{ message: { content: string } }>;
    }>("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: `Prompt: ${prompt}` },
        ],
      },
    });

    const raw = (res.choices[0]?.message?.content?.trim() ?? "[]")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const tags = parsed
      .map((t: unknown) =>
        typeof t === "string" ? t.toLowerCase().trim() : "",
      )
      .filter((t): t is string =>
        (AVAILABLE_TAGS as readonly string[]).includes(t),
      );

    console.log("[Tags] Inferred tags:", tags);
    return tags;
  } catch (err) {
    console.warn("[Tags] Tag inference failed:", err);
    return [];
  }
}
