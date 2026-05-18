import OpenAI from "openai";
import { useServerPostHog } from "../posthog";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://lumiar.app",
  "X-Title": "Lumiar",
} as const;

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
  inputImages: string[],
): Promise<string> {
  type ImageUrlItem = { type: "image_url"; image_url: { url: string } };
  type TextItem = { type: "text"; text: string };

  const userContent: string | Array<ImageUrlItem | TextItem> =
    inputImages.length > 0
      ? [
          ...inputImages.map(
            (img): ImageUrlItem => ({
              type: "image_url",
              image_url: { url: img },
            }),
          ),
          { type: "text", text: prompt },
        ]
      : prompt;

  const modalities = modelId.startsWith("google/")
    ? ["image", "text"]
    : ["image"];

  const startTime = Date.now();

  console.log("[AI] OpenRouter request", {
    provider: "openrouter",
    model: modelId,
    baseUrl: OPENROUTER_BASE_URL,
    imageCount: inputImages.length,
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

  const latencySeconds = (Date.now() - startTime) / 1000;

  if (result.usage) {
    console.log("[AI] OpenRouter response", {
      provider: "openrouter",
      model: modelId,
      usage: result.usage,
    });
  }

  const posthog = useServerPostHog();
  posthog.capture({
    distinctId: "server",
    event: "$ai_generation",
    properties: {
      $ai_provider: "openrouter",
      $ai_model: modelId,
      $ai_input_tokens: result.usage?.prompt_tokens ?? undefined,
      $ai_output_tokens: result.usage?.completion_tokens ?? undefined,
      $ai_latency: latencySeconds,
      $ai_base_url: OPENROUTER_BASE_URL,
    },
  });

  return imageUrl;
}

/**
/**
 * No longer needed — callers now pass a pre-built string[] of data URIs or URLs.
 * Kept as a no-op export to avoid breaking any imports during migration.
 * @deprecated Use the inputImages array parameter directly.
 */
export function resolveOpenRouterInputImage(
  inputImageBase64: string | null,
  inputImageUrl: string | null,
  resolvedInputImageBase64: string | null,
): string | null {
  return resolvedInputImageBase64 ?? inputImageBase64 ?? inputImageUrl ?? null;
}
