import OpenAI, { toFile } from "openai";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ASPECT_RATIO_TO_OPENAI_SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1365x1024",
  "3:4": "1024x1365",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

export const OPENAI_GPT_IMAGE_MODELS = new Set([
  "gpt-image-2",
  "gpt-image-1",
  "gpt-image-1-mini",
]);

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://lumiar.app",
  "X-Title": "Lumiar",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenRouterImageMessage {
  role: string;
  content: string | null;
  images?: Array<{ type: string; image_url: { url: string } }>;
}

interface OpenRouterResponse {
  choices: Array<{ message: OpenRouterImageMessage }>;
}

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface BunnyConfig {
  cdnUrl: string;
  storageHostname: string;
  storageZone: string;
  accessKey: string;
}

// ---------------------------------------------------------------------------
// OpenRouter client factory (shared by generate + polish-prompt)
// ---------------------------------------------------------------------------

export function createOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    defaultHeaders: OPENROUTER_HEADERS,
  });
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

export async function generateWithOpenAI(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  inputImageBase64: string | null,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const size = (ASPECT_RATIO_TO_OPENAI_SIZE[aspectRatio] ??
    "1024x1024") as Parameters<typeof client.images.generate>[0]["size"];

  if (inputImageBase64) {
    const rawBase64 = inputImageBase64.replace(
      /^data:image\/[a-z]+;base64,/,
      "",
    );
    const imageBuffer = Buffer.from(rawBase64, "base64");
    const imageFile = await toFile(imageBuffer, "image.png", {
      type: "image/png",
    });
    const res = await client.images.edit({
      model: modelId,
      image: imageFile,
      prompt,
      size,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned by OpenAI");
    return `data:image/png;base64,${b64}`;
  }

  const res = await client.images.generate({ model: modelId, prompt, size });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned by OpenAI");
  return `data:image/png;base64,${b64}`;
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
  return imageUrl;
}

// ---------------------------------------------------------------------------
// Input image resolution
// ---------------------------------------------------------------------------

/**
 * Guards against SSRF by blocking requests to private/loopback IP ranges
 * and localhost.
 */
function isSafeUrl(url: URL): boolean {
  const { hostname } = url;
  if (
    ["localhost", "0.0.0.0", "::1", "[::1]"].includes(hostname.toLowerCase())
  ) {
    return false;
  }
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
}

/**
 * Resolves an input image to a base64 data URI.
 * Prefers a pre-supplied base64 string, then fetches the URL.
 * Falls back to the Bunny storage API when the CDN returns a non-OK response.
 */
export async function resolveInputImageBase64(
  inputImageBase64: string | null,
  inputImageUrl: string | null,
  requestHeaders?: Record<string, string>,
  bunnyConfig?: BunnyConfig,
): Promise<string | null> {
  if (inputImageBase64) return inputImageBase64;
  if (!inputImageUrl) return null;

  const parsedUrl = new URL(inputImageUrl);
  if (!isSafeUrl(parsedUrl)) {
    throw new Error("Unsafe input image URL");
  }

  let response: Response;
  try {
    response = await fetch(inputImageUrl, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
        ...(requestHeaders ?? {}),
      },
    });
  } catch {
    response = new Response(null, { status: 599 });
  }

  if (!response.ok && bunnyConfig) {
    const inputUrl = new URL(inputImageUrl);
    const cdnOrigin = bunnyConfig.cdnUrl.startsWith("http")
      ? new URL(bunnyConfig.cdnUrl)
      : new URL(`https://${bunnyConfig.cdnUrl}`);

    if (inputUrl.host === cdnOrigin.host) {
      const inputPath = inputUrl.pathname.replace(/^\/+/, "");
      const storageUrl = `https://${bunnyConfig.storageHostname}/${bunnyConfig.storageZone}/${inputPath}`;
      response = await fetch(storageUrl, {
        headers: { AccessKey: bunnyConfig.accessKey },
      });
    }
  }

  if (!response.ok) throw new Error("Failed to fetch input image");

  const contentType = response.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/"))
    throw new Error("Input URL did not return an image");

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
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
