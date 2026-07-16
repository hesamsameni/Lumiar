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
  uploadToR2,
  type R2Config,
} from "../utils/r2";
import { inferTagsFromPrompt } from "../utils/tags";
import { useServerPostHog } from "../utils/posthog";
import { condensePrompt } from "../utils/polishPrompt";
import {
  creditsForOption,
  resolveQualityOption,
  type QualityOption,
} from "../utils/quality";

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
    aspectRatio,
    quality,
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

  let trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw createError({ statusCode: 400, message: "Prompt cannot be empty" });
  }

  const openrouterKey = config.openrouterApiKey as string;
  if (trimmedPrompt.length > 2000) {
    if (!openrouterKey) {
      throw createError({
        statusCode: 400,
        message:
          "Prompt exceeds 2,000 characters and cannot be summarized because the API key is missing",
      });
    }

    const condensed = await condensePrompt(trimmedPrompt, openrouterKey);
    trimmedPrompt = condensed.trim();
    if (!trimmedPrompt) {
      throw createError({
        statusCode: 400,
        message: "Prompt could not be condensed into a usable version",
      });
    }
    if (trimmedPrompt.length > 2000) {
      throw createError({
        statusCode: 400,
        message: "Prompt is too long even after summarization",
      });
    }
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
  if (quality != null && typeof quality !== "string") {
    throw createError({ statusCode: 400, message: "Invalid quality" });
  }

  // --- Resolve the real cost + balance server-side (never trust the client) ---
  // The authoritative per-generation cost comes from `ai_models`, and the
  // balance is checked before we spend money calling a provider.
  const supabase = await serverSupabaseClient(event);

  const { data: modelRow } = (await (supabase as any)
    .from("ai_models")
    .select("tokens_per_generation, quality_options, default_quality")
    .eq("id", modelId)
    .maybeSingle()) as {
    data: {
      tokens_per_generation: number;
      quality_options: QualityOption[] | null;
      default_quality: string | null;
    } | null;
  };

  if (!modelRow) {
    throw createError({ statusCode: 400, message: "Unknown model" });
  }

  // Resolve the selected quality tier against the model's options (authoritative).
  const qualityOpt = resolveQualityOption(
    modelRow.quality_options,
    modelRow.default_quality,
    typeof quality === "string" ? quality : null,
  );
  const resolvedQuality = qualityOpt?.value ?? null;
  // Native provider value (OpenAI `quality` / Gemini `imageSize`).
  const providerQuality = qualityOpt ? (qualityOpt.param ?? qualityOpt.value) : null;
  const tokenCost = creditsForOption(
    modelRow.tokens_per_generation,
    modelRow.quality_options,
    modelRow.default_quality,
    typeof quality === "string" ? quality : null,
  );

  const { data: profileRow } = (await (supabase as any)
    .from("profiles")
    .select("token_balance, is_admin")
    .eq("id", user.id)
    .single()) as {
    data: { token_balance: number; is_admin: boolean } | null;
  };
  const isAdmin = !!profileRow?.is_admin;
  const balance = Math.max(0, profileRow?.token_balance ?? 0);

  // --- Dev mode: return mock image without calling AI providers ---
  const DEV_MODE_PREFIX = "dev mode hesam";
  const isDevMode = trimmedPrompt.toLowerCase().startsWith(DEV_MODE_PREFIX);

  // --- Balance gate: block before any paid provider call ---
  if (!isDevMode && !isAdmin && balance < tokenCost) {
    throw createError({
      statusCode: 402,
      message: `Insufficient tokens: this model requires ${tokenCost} but you have ${balance}.`,
    });
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

  const r2Config: R2Config = {
    cdnUrl: String(config.public.r2PublicUrl),
    accountId: String(config.r2AccountId),
    accessKeyId: String(config.r2AccessKeyId),
    secretAccessKey: String(config.r2SecretAccessKey),
    bucketName: String(config.r2BucketName),
  };

  // --- Image generation + tag inference (in parallel) ---
  // Tag inference only needs the prompt text and finishes in ~2-3 s.
  // Running it concurrently with the AI image call (which takes 30-120 s)
  // means tags are ready before the image is, adding 0 s to the critical path.
  const tagsPromise = inferTagsFromPrompt(
    config.openrouterApiKey as string,
    trimmedPrompt,
  );

  // Resolve the editing URL (if present) to base64 server-side, then combine
  // with any directly-uploaded base64 images into a single ordered array.
  let imageBase64: string;
  try {
    if (isDevMode) {
      // Return a 1x1 pink PNG as a mock result — skip R2, DB, and token deduction
      return {
        generationId: "dev-mock-" + Date.now(),
        imageUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      };
    }

    const resolvedEditingBase64 = await resolveInputImageBase64(
      null,
      inputImageUrl ?? null,
      INPUT_IMAGE_REQUEST_HEADERS,
      r2Config,
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
        providerQuality,
      );
    } else if (isGoogle) {
      imageBase64 = await generateWithGoogle(
        config.googleApiKey as string,
        actualModelId,
        trimmedPrompt,
        aspectRatio ?? "1:1",
        allImagesBase64,
        providerQuality,
      );
    } else {
      // OpenRouter's /images router: the tier param is a resolution
      // ("1K"/"2K"/"4K"); providers without a resolution knob ignore it.
      imageBase64 = await generateWithOpenRouter(
        config.openrouterApiKey as string,
        actualModelId,
        trimmedPrompt,
        aspectRatio ?? "1:1",
        allImagesBase64,
        providerQuality,
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

  // --- Upload to R2 (tags are already resolving in background) ---
  // The result is a data URL whose media type may be png/jpeg/webp (raster) or
  // image/svg+xml (vectorization models). Parse it generically so SVG output
  // is stored + served with the right extension and content type.
  const EXT_BY_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  const dataUrlMatch = /^data:([^;]+);base64,([\s\S]*)$/.exec(imageBase64);
  const outputMime = dataUrlMatch?.[1] ?? "image/png";
  const base64Payload = dataUrlMatch?.[2] ?? imageBase64;
  const outputExt = EXT_BY_MIME[outputMime] ?? "png";
  const imageBuffer = Buffer.from(base64Payload, "base64");
  const outputPath = `lumiar-generations/${user.id}/${generateStorageFilename(outputExt)}`;

  let outputImageUrl: string;
  let autoTags: string[];
  try {
    [outputImageUrl, autoTags] = await Promise.all([
      (async () => {
        await uploadToR2(r2Config, outputPath, imageBuffer, outputMime);
        return buildCdnUrl(r2Config.cdnUrl, outputPath);
      })(),
      tagsPromise,
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

  const { data: generation, error: dbError } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      prompt: trimmedPrompt,
      model_id: modelId,
      model_name: modelName,
      input_image_url: primaryInputUrl,
      output_image_url: outputImageUrl,
      tokens_used: tokenCost,
      aspect_ratio: aspectRatio ?? "1:1",
      quality: resolvedQuality,
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

  // --- Token deduction (server-side so it survives client timeouts) ---
  // Deducts atomically via the `spend_tokens` RPC (single UPDATE guarded by
  // balance), avoiding the read-modify-write race of the previous approach.
  // Admins generate for free.
  if (!isAdmin && tokenCost > 0) {
    try {
      const { data: spent, error: spendErr } = await (supabase as any).rpc(
        "spend_tokens",
        { p_user_id: user.id, p_amount: tokenCost },
      );
      if (spendErr || spent === false) {
        console.error(
          "[generate] Token deduction failed (non-fatal):",
          spendErr ?? "insufficient balance at spend time",
        );
      } else {
        await (supabase as any).from("token_transactions").insert({
          user_id: user.id,
          amount: -tokenCost,
          type: "generation",
          reference_id: generationId,
          description: `Generation with ${modelName}`,
        });
      }
    } catch (err) {
      console.error("[generate] Token deduction failed (non-fatal):", err);
    }
  }

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
      tokens_used: tokenCost,
      aspect_ratio: aspectRatio ?? "1:1",
      quality: resolvedQuality,
      has_input_images: rawBase64Inputs.length > 0 || !!inputImageUrl,
      is_edit: !!parentId,
      generation_id: generationId,
    },
  });

  return {
    imageUrl: outputImageUrl,
    generationId,
  };
});
