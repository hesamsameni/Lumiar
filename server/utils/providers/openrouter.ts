import OpenAI from "openai";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://lumiar.app",
  "X-Title": "Lumiar",
} as const;

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

interface OpenRouterImageMessage {
  role: string;
  content: string | null;
  images?: Array<{ type: string; image_url: { url: string } }>;
}

interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenRouterResponse {
  choices: Array<{ message: OpenRouterImageMessage }>;
  usage?: OpenRouterUsage;
}

export function createOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    defaultHeaders: OPENROUTER_HEADERS,
  });
}

export async function generateWithOpenRouter(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  inputImage: string | null,
): Promise<string> {
  const userContent: MessageContent = inputImage
    ? [
        { type: "image_url", image_url: { url: inputImage } },
        { type: "text", text: prompt },
      ]
    : prompt;

  const modalities = modelId.startsWith("google/")
    ? ["image", "text"]
    : ["image"];

  console.log("[AI] OpenRouter request", {
    provider: "openrouter",
    model: modelId,
    baseUrl: OPENROUTER_BASE_URL,
    hasImage: !!inputImage,
    modalities,
  });

  let result: OpenRouterResponse;
  try {
    result = await $fetch<OpenRouterResponse>(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...OPENROUTER_HEADERS,
        },
        body: {
          model: modelId,
          messages: [{ role: "user", content: userContent }],
          modalities,
          ...(aspectRatio !== "auto"
            ? { image_config: { aspect_ratio: aspectRatio } }
            : {}),
        },
      },
    );
  } catch (err: unknown) {
    const details =
      typeof err === "object" && err !== null && "data" in err
        ? (err as { data?: unknown }).data
        : null;
    const msg =
      details && typeof details === "object"
        ? JSON.stringify(details)
        : String(details ?? "");
    throw new Error(
      msg ? `OpenRouter request failed: ${msg}` : "OpenRouter request failed",
    );
  }

  const imageUrl =
    result.choices[0]?.message?.images?.[0]?.image_url?.url ?? null;
  if (!imageUrl) throw new Error("No image returned by OpenRouter");

  if (result.usage) {
    console.log("[AI] OpenRouter response", {
      provider: "openrouter",
      model: modelId,
      usage: result.usage,
    });
  }

  return imageUrl;
}

/**
 * Picks the best available input image representation for OpenRouter.
 * Prefers resolved base64 → original base64 → original URL.
 */
export function resolveOpenRouterInputImage(
  inputImageBase64: string | null,
  inputImageUrl: string | null,
  resolvedInputImageBase64: string | null,
): string | null {
  return resolvedInputImageBase64 ?? inputImageBase64 ?? inputImageUrl ?? null;
}
