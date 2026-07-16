import OpenAI from "openai";
import { useServerPostHog } from "../posthog";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://lumiar.app",
  "X-Title": "Lumiar",
} as const;

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

// Response of the dedicated image router (POST /images).
interface OpenRouterImagesResponse {
  created?: number;
  data?: Array<{ b64_json?: string; media_type?: string }>;
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
  // Normalized resolution tier ("512" | "1K" | "2K" | "4K"); providers without a
  // resolution knob ignore it. Optional native quality ("low"|"medium"|"high").
  resolution?: string | null,
  quality?: string | null,
): Promise<string> {
  const body: Record<string, unknown> = { model: modelId, prompt };
  if (aspectRatio && aspectRatio !== "auto") body.aspect_ratio = aspectRatio;
  if (resolution) body.resolution = resolution;
  if (quality) body.quality = quality;
  // Vectorization models (e.g. Recraft *vector) emit SVG markup — ask for it
  // explicitly, otherwise the router returns a rasterized PNG by default.
  const isVector = /vector/i.test(modelId);
  if (isVector) body.output_format = "svg";
  if (inputImages.length > 0) {
    // Image-to-image guidance (base64 data URLs or HTTP(S) URLs).
    body.input_references = inputImages.map((url) => ({
      type: "image_url",
      image_url: { url },
    }));
  }

  const startTime = Date.now();

  console.log("[AI] OpenRouter request", {
    provider: "openrouter",
    model: modelId,
    baseUrl: OPENROUTER_BASE_URL,
    endpoint: "/images",
    imageCount: inputImages.length,
    resolution: resolution ?? "default",
    quality: quality ?? "default",
  });

  const callImages = (payload: Record<string, unknown>) =>
    $fetch<OpenRouterImagesResponse>(`${OPENROUTER_BASE_URL}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...OPENROUTER_HEADERS,
      },
      body: payload,
    });

  const formatError = (err: unknown): Error => {
    const details =
      typeof err === "object" && err !== null && "data" in err
        ? (err as { data?: unknown }).data
        : null;
    const msg =
      details && typeof details === "object"
        ? JSON.stringify(details)
        : String(details ?? "");
    return new Error(
      msg ? `OpenRouter request failed: ${msg}` : "OpenRouter request failed",
    );
  };

  let result: OpenRouterImagesResponse;
  try {
    result = await callImages(body);
  } catch (err: unknown) {
    // Resolution tiers are provider-specific: some endpoints reject a tier that
    // is below/above their min/max size. If we sent a resolution and the request
    // fails, retry once without it so the provider's default size is used
    // instead of hard-failing the whole generation.
    const status =
      (err as { status?: number; statusCode?: number })?.status ??
      (err as { statusCode?: number })?.statusCode;
    if (resolution && (status === 400 || status === 422 || status === 502)) {
      console.warn(
        `[AI] OpenRouter /images rejected resolution "${resolution}" for ${modelId}; retrying without it.`,
      );
      const { resolution: _dropped, ...retryBody } = body;
      try {
        result = await callImages(retryBody);
      } catch (retryErr: unknown) {
        throw formatError(retryErr);
      }
    } else {
      throw formatError(err);
    }
  }

  const item = result.data?.[0];
  if (!item?.b64_json) throw new Error("No image returned by OpenRouter");
  const mimeType = item.media_type ?? "image/png";

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

  return `data:${mimeType};base64,${item.b64_json}`;
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
