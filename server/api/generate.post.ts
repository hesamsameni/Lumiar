import { serverSupabaseClient } from "#supabase/server";
import OpenAI, { toFile } from "openai";

// OpenRouter image generation response shape
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

// Map OpenRouter aspect ratios to OpenAI sizes (closest match)
const ASPECT_RATIO_TO_OPENAI_SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1365x1024",
  "3:4": "1024x1365",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

const OPENAI_GPT_IMAGE_MODELS = new Set([
  "gpt-image-2",
  "gpt-image-1",
  "gpt-image-1-mini",
]);

const AVAILABLE_TAGS = [
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
];

/**
 * Use a cheap OpenRouter model to automatically pick relevant tags for a prompt.
 * Returns an empty array on any error — never throws.
 */
async function inferTagsFromPrompt(
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
    // Case-insensitive match so capitalised responses still work
    const tags = parsed
      .map((t: unknown) =>
        typeof t === "string" ? t.toLowerCase().trim() : "",
      )
      .filter((t): t is string => AVAILABLE_TAGS.includes(t));
    console.log("[Tags] Raw response:", raw, "=> Tags:", tags);
    return tags;
  } catch (err) {
    console.warn("[Tags] Tag inference failed:", err);
    return [];
  }
}

/**
 * Generate an image using the OpenAI Images API.
 * Uses Responses API tool for GPT image edits, /generations for text-to-image.
 */
async function generateWithOpenAI(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  inputImageBase64: string | null,
): Promise<string> {
  console.log("[OpenAI] Model:", modelId);
  const client = new OpenAI({ apiKey });
  const size = (ASPECT_RATIO_TO_OPENAI_SIZE[aspectRatio] ??
    "1024x1024") as Parameters<typeof client.images.generate>[0]["size"];

  if (inputImageBase64) {
    console.log("[OpenAI] Using Images API edit endpoint");
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

  console.log("[OpenAI] Using Images API (generate)");
  const res = await client.images.generate({
    model: modelId,
    prompt,
    size,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned by OpenAI");
  return `data:image/png;base64,${b64}`;
}

/**
 * Generate an image using OpenRouter (Recraft, Flux, Gemini, etc.).
 */
async function generateWithOpenRouter(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  inputImage: string | null,
): Promise<string> {
  const resolvedImageContent: {
    type: "image_url";
    image_url: { url: string };
  } | null = inputImage
    ? { type: "image_url", image_url: { url: inputImage } }
    : null;

  const userContent: MessageContent = resolvedImageContent
    ? [resolvedImageContent, { type: "text", text: prompt }]
    : prompt;

  const isGemini = modelId.startsWith("google/");
  const modalities = isGemini ? ["image", "text"] : ["image"];

  const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
  console.log("[OpenRouter] Model:", modelId);
  console.log("[OpenRouter] URL:", openRouterUrl);
  let result: OpenRouterResponse;
  try {
    result = await $fetch<OpenRouterResponse>(openRouterUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lumiar.app",
        "X-Title": "Lumiar",
      },
      body: {
        model: modelId,
        messages: [{ role: "user", content: userContent }],
        modalities,
        image_config: { aspect_ratio: aspectRatio },
      },
    });
  } catch (err: unknown) {
    const details =
      typeof err === "object" && err !== null && "data" in err
        ? (err as { data?: unknown }).data
        : null;
    const detailsMessage =
      details && typeof details === "object"
        ? JSON.stringify(details)
        : String(details ?? "");
    throw new Error(
      detailsMessage
        ? `OpenRouter request failed: ${detailsMessage}`
        : "OpenRouter request failed",
    );
  }

  const imageBase64 =
    result.choices[0]?.message?.images?.[0]?.image_url?.url ?? null;
  if (!imageBase64) throw new Error("No image returned by OpenRouter");
  return imageBase64;
}

async function resolveInputImageBase64(
  inputImageBase64: string | null,
  inputImageUrl: string | null,
  requestHeaders?: Record<string, string>,
  bunnyConfig?: {
    cdnUrl: string;
    storageHostname: string;
    storageZone: string;
    accessKey: string;
  },
): Promise<string | null> {
  if (inputImageBase64) return inputImageBase64;
  if (!inputImageUrl) return null;

  const requestInit = {
    headers: {
      Accept: "image/*,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      ...(requestHeaders ?? {}),
    },
  };

  let response: Response;
  try {
    response = await fetch(inputImageUrl, requestInit);
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
        headers: {
          AccessKey: bunnyConfig.accessKey,
        },
      });
    }
  }

  if (!response.ok) {
    throw new Error("Failed to fetch input image");
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error("Input URL did not return an image");
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

function resolveOpenRouterInputImage(
  inputImageBase64: string | null,
  inputImageUrl: string | null,
  resolvedInputImageBase64: string | null,
): string | null {
  return resolvedInputImageBase64 ?? inputImageBase64 ?? inputImageUrl ?? null;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const user = await requireUser(event);

  const body = await readBody(event);
  const {
    prompt,
    modelId,
    modelName,
    inputImageBase64,
    inputImageUrl,
    tokensUsed,
    aspectRatio,
    parentId,
  } = body;

  if (
    typeof prompt !== "string" ||
    typeof modelId !== "string" ||
    typeof modelName !== "string"
  ) {
    throw createError({
      statusCode: 400,
      message: "Missing prompt, modelId, or modelName",
    });
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw createError({ statusCode: 400, message: "Prompt cannot be empty" });
  }
  if (trimmedPrompt.length > 2000) {
    throw createError({ statusCode: 400, message: "Prompt is too long" });
  }
  if (inputImageBase64 && typeof inputImageBase64 !== "string") {
    throw createError({ statusCode: 400, message: "Invalid input image" });
  }
  if (inputImageUrl && typeof inputImageUrl !== "string") {
    throw createError({ statusCode: 400, message: "Invalid input image URL" });
  }
  if (typeof inputImageUrl === "string") {
    let parsed: URL;
    try {
      parsed = new URL(inputImageUrl);
    } catch {
      throw createError({
        statusCode: 400,
        message: "Invalid input image URL",
      });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw createError({
        statusCode: 400,
        message: "Invalid input image URL",
      });
    }
  }
  if (aspectRatio && typeof aspectRatio !== "string") {
    throw createError({ statusCode: 400, message: "Invalid aspect ratio" });
  }

  // Route to the correct provider — transparent to the user
  const isOpenAI = modelId.startsWith("openai/");
  const actualModelId = isOpenAI ? modelId.replace("openai/", "") : modelId;

  if (isOpenAI && !OPENAI_GPT_IMAGE_MODELS.has(actualModelId)) {
    throw createError({
      statusCode: 400,
      message: `Unsupported OpenAI model '${actualModelId}'.`,
    });
  }

  let imageBase64: string;
  try {
    const inputImageRequestHeaders = {
      Referer: "https://lumiar.app",
      Origin: "https://lumiar.app",
    };
    const bunnyImageConfig = {
      cdnUrl: String(config.public.bunnyCdnUrl),
      storageHostname: String(config.bunnyStorageHostname),
      storageZone: String(config.bunnyStorageZone),
      accessKey: String(config.bunnyApiKey),
    };

    const resolvedInputImageBase64 = isOpenAI
      ? await resolveInputImageBase64(
          inputImageBase64 ?? null,
          inputImageUrl ?? null,
          inputImageRequestHeaders,
          bunnyImageConfig,
        )
      : null;
    let resolvedOpenRouterInputImage: string | null = null;

    if (!isOpenAI) {
      let openRouterResolvedBase64: string | null = null;
      try {
        openRouterResolvedBase64 = await resolveInputImageBase64(
          inputImageBase64 ?? null,
          inputImageUrl ?? null,
          inputImageRequestHeaders,
          bunnyImageConfig,
        );
      } catch {
        openRouterResolvedBase64 = null;
      }

      resolvedOpenRouterInputImage = resolveOpenRouterInputImage(
        inputImageBase64 ?? null,
        inputImageUrl ?? null,
        openRouterResolvedBase64,
      );
    }

    console.log(
      "[Handler] Requested model:",
      modelId,
      "(isOpenAI:",
      isOpenAI,
      ")",
    );
    imageBase64 = isOpenAI
      ? await generateWithOpenAI(
          config.openaiApiKey as string,
          actualModelId,
          trimmedPrompt,
          aspectRatio ?? "1:1",
          resolvedInputImageBase64,
        )
      : await generateWithOpenRouter(
          config.openrouterApiKey as string,
          actualModelId,
          trimmedPrompt,
          aspectRatio ?? "1:1",
          resolvedOpenRouterInputImage,
        );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    throw createError({ statusCode: 500, message: msg });
  }

  // Upload the generated image to Bunny CDN
  const ext = "png";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const outputPath = `generations/${user.id}/${filename}`;
  const imageBuffer = Buffer.from(
    imageBase64.replace(/^data:image\/[a-z]+;base64,/, ""),
    "base64",
  );
  const uploadUrl = `https://${config.bunnyStorageHostname}/${config.bunnyStorageZone}/${outputPath}`;
  const cdnBase = config.public.bunnyCdnUrl.replace(/\/+$/, "");
  const outputImageUrl = cdnBase.startsWith("http")
    ? `${cdnBase}/${outputPath}`
    : `https://${cdnBase}/${outputPath}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: config.bunnyApiKey,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });
  if (!uploadRes.ok) {
    throw createError({
      statusCode: 500,
      message: "Failed to upload generated image",
    });
  }

  // Auto-generate tags from the prompt using a cheap model (best-effort, non-blocking)
  const autoTags = await inferTagsFromPrompt(
    config.openrouterApiKey as string,
    trimmedPrompt,
  );

  // Insert the generation record server-side using the user's authenticated client
  // so RLS policy (auth.uid() = user_id) is satisfied.
  const supabase = await serverSupabaseClient(event);
  const { data: generation, error: dbError } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      prompt: trimmedPrompt,
      model_id: modelId,
      model_name: modelName,
      input_image_url: inputImageUrl ?? null,
      output_image_url: outputImageUrl,
      tokens_used: typeof tokensUsed === "number" ? tokensUsed : 0,
      aspect_ratio: aspectRatio ?? "1:1",
      parent_id: parentId ?? null,
      metadata: { tags: autoTags },
    } as never)
    .select("id")
    .single();

  if (dbError) {
    throw createError({
      statusCode: 500,
      message: "Failed to save generation",
    });
  }

  return {
    imageUrl: outputImageUrl,
    generationId: (generation as { id: string }).id,
  };
});
