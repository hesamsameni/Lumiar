import { serverSupabaseClient } from "#supabase/server";
import {
  generateWithOpenAI,
  generateWithOpenRouter,
  generateWithGoogle,
  resolveInputImageBase64,
} from "../utils/providers";
import {
  buildCdnUrl,
  generateStorageFilename,
  uploadToBunny,
} from "../utils/bunny";
import { inferTagsFromPrompt } from "../utils/tags";
import { useServerPostHog } from "../utils/posthog";

const INPUT_IMAGE_REQUEST_HEADERS = {
  Referer: "https://lumiar.app",
  Origin: "https://lumiar.app",
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const user = await requireUser(event);

  const body = await readBody(event);
  const {
    prompt,
    modelId,
    modelName,
    provider,
    // Legacy single-image fields (backward compat)
    inputImageBase64,
    inputImageUrl,
    // Multi-image fields
    inputImagesBase64,
    inputImageUrls,
    tokensUsed,
    aspectRatio,
    parentId,
  } = body;

  // --- Input validation ---
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

  // Validate all submitted base64 images
  const rawBase64Inputs: string[] = [
    ...(Array.isArray(inputImagesBase64) ? inputImagesBase64 : []),
    ...(typeof inputImageBase64 === "string" ? [inputImageBase64] : []),
  ];
  for (const img of rawBase64Inputs) {
    if (typeof img !== "string") {
      throw createError({ statusCode: 400, message: "Invalid input image" });
    }
    if (img.length > 20_000_000) {
      throw createError({
        statusCode: 400,
        message: "Input image is too large",
      });
    }
  }
  if (rawBase64Inputs.length > 8) {
    throw createError({
      statusCode: 400,
      message: "Too many input images (max 8)",
    });
  }

  // Validate the editing URL (legacy single, server-resolved)
  if (inputImageUrl != null) {
    if (typeof inputImageUrl !== "string") {
      throw createError({
        statusCode: 400,
        message: "Invalid input image URL",
      });
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(inputImageUrl);
    } catch {
      throw createError({
        statusCode: 400,
        message: "Invalid input image URL",
      });
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw createError({
        statusCode: 400,
        message: "Invalid input image URL",
      });
    }
  }
  if (aspectRatio != null && typeof aspectRatio !== "string") {
    throw createError({ statusCode: 400, message: "Invalid aspect ratio" });
  }

  // --- Provider routing ---
  const resolvedProvider: string =
    typeof provider === "string" ? provider : "openrouter";
  const isOpenAI = resolvedProvider === "openai";
  const isGoogle = resolvedProvider === "google";
  // Model IDs in the DB may carry a vendor prefix (e.g. "openai/gpt-image-1",
  // "google/gemini-2.0-flash-preview-image-generation"). Strip the prefix before
  // hitting the native API so the provider receives the bare model name.
  const actualModelId = isOpenAI
    ? modelId.replace(/^openai\//, "")
    : isGoogle
      ? modelId.replace(/^google\//, "")
      : modelId;

  const bunnyConfig = {
    cdnUrl: String(config.public.bunnyCdnUrl),
    storageHostname: String(config.bunnyStorageHostname),
    storageZone: String(config.bunnyStorageZone),
    accessKey: String(config.bunnyApiKey),
  };

  // --- Image generation ---
  // Resolve the editing URL (if present) to base64 server-side, then combine
  // with any directly-uploaded base64 images into a single ordered array.
  let imageBase64: string;
  try {
    const resolvedEditingBase64 = await resolveInputImageBase64(
      null,
      inputImageUrl ?? null,
      INPUT_IMAGE_REQUEST_HEADERS,
      bunnyConfig,
    ).catch(() => null);

    const allImagesBase64: string[] = [
      ...(resolvedEditingBase64 ? [resolvedEditingBase64] : []),
      ...rawBase64Inputs,
    ];

    if (isOpenAI) {
      imageBase64 = await generateWithOpenAI(
        config.openaiApiKey as string,
        actualModelId,
        trimmedPrompt,
        aspectRatio ?? "1:1",
        allImagesBase64,
      );
    } else if (isGoogle) {
      imageBase64 = await generateWithGoogle(
        config.googleApiKey as string,
        actualModelId,
        trimmedPrompt,
        aspectRatio ?? "1:1",
        allImagesBase64,
      );
    } else {
      imageBase64 = await generateWithOpenRouter(
        config.openrouterApiKey as string,
        actualModelId,
        trimmedPrompt,
        aspectRatio ?? "1:1",
        allImagesBase64,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    throw createError({ statusCode: 500, message: msg });
  }

  // --- Build prompt chain (fetch parent metadata if editing) ---
  let promptChain: string[] = [trimmedPrompt];
  if (parentId && typeof parentId === "string") {
    try {
      const supabaseForChain = await serverSupabaseClient(event);
      const { data: parentGenRaw } = await supabaseForChain
        .from("generations")
        .select("prompt, metadata")
        .eq("id", parentId)
        .single();
      const parentGen = parentGenRaw as {
        prompt: string;
        metadata: { prompt_chain?: string[] } | null;
      } | null;
      if (parentGen) {
        const parentChain = parentGen.metadata?.prompt_chain ?? [
          parentGen.prompt,
        ];
        promptChain = [...parentChain, trimmedPrompt];
      }
    } catch {
      // silently fall back to single-prompt chain
    }
  }

  // --- Upload + tag inference (parallel) ---
  const imageBuffer = Buffer.from(
    imageBase64.replace(/^data:image\/[a-z]+;base64,/, ""),
    "base64",
  );
  const outputPath = `generations/${user.id}/${generateStorageFilename("png")}`;

  let outputImageUrl: string;
  let autoTags: string[];
  try {
    [outputImageUrl, autoTags] = await Promise.all([
      (async () => {
        await uploadToBunny(
          bunnyConfig.storageHostname,
          bunnyConfig.storageZone,
          bunnyConfig.accessKey,
          outputPath,
          imageBuffer,
        );
        return buildCdnUrl(bunnyConfig.cdnUrl, outputPath);
      })(),
      inferTagsFromPrompt(config.openrouterApiKey as string, trimmedPrompt),
    ]);
  } catch {
    throw createError({
      statusCode: 500,
      message: "Failed to upload generated image",
    });
  }

  // --- Persist record (RLS satisfied via authenticated client) ---
  // For multi-image: store first CDN URL in the dedicated column; all URLs in metadata.
  const allInputCdnUrls: string[] = [
    ...(inputImageUrl ? [inputImageUrl as string] : []),
    ...(Array.isArray(inputImageUrls) ? (inputImageUrls as string[]) : []),
  ];
  const primaryInputUrl = allInputCdnUrls[0] ?? null;

  const supabase = await serverSupabaseClient(event);
  const { data: generation, error: dbError } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      prompt: trimmedPrompt,
      model_id: modelId,
      model_name: modelName,
      input_image_url: primaryInputUrl,
      output_image_url: outputImageUrl,
      tokens_used: typeof tokensUsed === "number" ? Math.max(0, tokensUsed) : 0,
      aspect_ratio: aspectRatio ?? "1:1",
      parent_id: parentId ?? null,
      metadata: {
        tags: autoTags,
        prompt_chain: promptChain,
        ...(allInputCdnUrls.length > 1
          ? { input_image_urls: allInputCdnUrls }
          : {}),
      },
    } as never)
    .select("id")
    .single();

  if (dbError) {
    throw createError({
      statusCode: 500,
      message: "Failed to save generation",
    });
  }

  const generationId = (generation as { id: string }).id;

  const sessionId = getHeader(event, "x-posthog-session-id");
  const distinctId = getHeader(event, "x-posthog-distinct-id");
  const posthog = useServerPostHog();
  posthog.capture({
    distinctId: distinctId ?? user.id,
    event: "image_generated",
    properties: {
      $session_id: sessionId,
      model_id: modelId,
      model_name: modelName,
      provider: resolvedProvider,
      tokens_used: typeof tokensUsed === "number" ? Math.max(0, tokensUsed) : 0,
      aspect_ratio: aspectRatio ?? "1:1",
      has_input_images:
        rawBase64Inputs.length > 0 || !!inputImageUrl,
      is_edit: !!parentId,
      generation_id: generationId,
    },
  });

  return {
    imageUrl: outputImageUrl,
    generationId,
  };
});
