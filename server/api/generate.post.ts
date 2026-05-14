import { serverSupabaseClient } from "#supabase/server";
import OpenAI from "openai";

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
  "1:1":  "1024x1024",
  "4:3":  "1365x1024",
  "3:4":  "1024x1365",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "3:2":  "1536x1024",
  "2:3":  "1024x1536",
};

/**
 * Generate an image using the OpenAI Images API.
 * Uses /edits when an input image is provided, /generations otherwise.
 */
async function generateWithOpenAI(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  inputImageBase64: string | null,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const size = (ASPECT_RATIO_TO_OPENAI_SIZE[aspectRatio] ?? "1024x1024") as Parameters<typeof client.images.generate>[0]["size"];

  if (inputImageBase64) {
    // Strip the data URL prefix to get raw base64, then convert to a File
    const base64Data = inputImageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    const mimeMatch = inputImageBase64.match(/^data:(image\/[a-z]+);base64,/);
    const mimeType = mimeMatch?.[1] ?? "image/png";
    const ext = mimeType.split("/")[1] ?? "png";
    const imageBuffer = Buffer.from(base64Data, "base64");
    const imageFile = new File([imageBuffer], `input.${ext}`, { type: mimeType });

    const res = await client.images.edit({
      model: modelId,
      image: imageFile,
      prompt,
      size: size as Parameters<typeof client.images.edit>[0]["size"],
      response_format: "b64_json",
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned by OpenAI");
    return `data:image/png;base64,${b64}`;
  }

  const res = await client.images.generate({
    model: modelId,
    prompt,
    size,
    response_format: "b64_json",
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
  inputImageBase64: string | null,
): Promise<string> {
  const resolvedImageContent: {
    type: "image_url";
    image_url: { url: string };
  } | null = inputImageBase64
    ? { type: "image_url", image_url: { url: inputImageBase64 } }
    : null;

  const userContent: MessageContent = resolvedImageContent
    ? [resolvedImageContent, { type: "text", text: prompt }]
    : prompt;

  const isGemini = modelId.startsWith("google/");
  const modalities = isGemini ? ["image", "text"] : ["image"];

  const result = await $fetch<OpenRouterResponse>(
    "https://openrouter.ai/api/v1/chat/completions",
    {
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
    },
  );

  const imageBase64 =
    result.choices[0]?.message?.images?.[0]?.image_url?.url ?? null;
  if (!imageBase64) throw new Error("No image returned by OpenRouter");
  return imageBase64;
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
    tags,
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
  if (aspectRatio && typeof aspectRatio !== "string") {
    throw createError({ statusCode: 400, message: "Invalid aspect ratio" });
  }

  // Route to the correct provider — transparent to the user
  const isOpenAI = modelId.startsWith("openai/");
  const actualModelId = isOpenAI ? modelId.replace("openai/", "") : modelId;

  let imageBase64: string;
  try {
    imageBase64 = isOpenAI
      ? await generateWithOpenAI(
          config.openaiApiKey as string,
          actualModelId,
          trimmedPrompt,
          aspectRatio ?? "1:1",
          inputImageBase64 ?? null,
        )
      : await generateWithOpenRouter(
          config.openrouterApiKey as string,
          actualModelId,
          trimmedPrompt,
          aspectRatio ?? "1:1",
          inputImageBase64 ?? null,
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
      metadata: { tags: Array.isArray(tags) ? tags : [] },
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
