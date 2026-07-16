import { serverSupabaseClient } from "#supabase/server";
import { submitVideoJob } from "../utils/providers/openrouter-video";
import { inferTagsFromPrompt } from "../utils/tags";
import { useServerPostHog } from "../utils/posthog";
import { resolveQualityOption, type QualityOption } from "../utils/quality";

interface VideoModelRow {
  tokens_per_generation: number;
  duration_seconds: number;
  supported_durations: number[];
  resolution: string | null;
  resolution_options: QualityOption[] | null;
  default_resolution: string | null;
  supports_image_input: boolean;
  supports_last_frame: boolean;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const user = await requireUser(event);

  const body = await readBody(event);
  const {
    prompt,
    modelId,
    modelName,
    durationSeconds,
    aspectRatio,
    resolution: requestedResolution,
    // New explicit image slots.
    firstFrameUrl,
    lastFrameUrl,
    referenceUrl,
    // Legacy single-image fields (mapped below for backward compat).
    inputImageUrl,
    imageMode,
  } = body;

  // Map legacy { inputImageUrl, imageMode } onto the explicit slots.
  const legacyFirst =
    imageMode !== "reference" && typeof inputImageUrl === "string"
      ? inputImageUrl
      : null;
  const legacyReference =
    imageMode === "reference" && typeof inputImageUrl === "string"
      ? inputImageUrl
      : null;
  const rawFirstFrame =
    typeof firstFrameUrl === "string" ? firstFrameUrl : legacyFirst;
  const rawLastFrame = typeof lastFrameUrl === "string" ? lastFrameUrl : null;
  const rawReference =
    typeof referenceUrl === "string" ? referenceUrl : legacyReference;

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
    throw createError({
      statusCode: 400,
      message: "Prompt is too long (max 2000 characters)",
    });
  }
  if (inputImageUrl != null && typeof inputImageUrl !== "string") {
    throw createError({ statusCode: 400, message: "Invalid input image URL" });
  }

  // Dev mode: prompts starting with this prefix skip the provider call, credit
  // deduction, and OpenRouter entirely — a placeholder clip is stored instead.
  const DEV_MODE_PREFIX = "dev mode hesam";
  const isDevMode = trimmedPrompt.toLowerCase().startsWith(DEV_MODE_PREFIX);

  const openrouterKey = config.openrouterApiKey as string;
  if (!openrouterKey && !isDevMode) {
    throw createError({
      statusCode: 500,
      message: "Video generation is not configured",
    });
  }

  const supabase = await serverSupabaseClient(event);

  // --- Authoritative model + cost (never trust the client) ---
  const { data: modelRow } = (await (supabase as any)
    .from("video_models")
    .select(
      "tokens_per_generation, duration_seconds, supported_durations, resolution, resolution_options, default_resolution, supports_image_input, supports_last_frame",
    )
    .eq("id", modelId)
    .maybeSingle()) as { data: VideoModelRow | null };

  if (!modelRow) {
    throw createError({ statusCode: 400, message: "Unknown video model" });
  }

  const baseDuration = Math.max(1, modelRow.duration_seconds || 1);
  const supported =
    Array.isArray(modelRow.supported_durations) &&
    modelRow.supported_durations.length
      ? modelRow.supported_durations
      : [baseDuration];
  const requested = Number(durationSeconds) || baseDuration;
  const duration = supported.includes(requested) ? requested : baseDuration;

  // Resolve the selected resolution tier (authoritative). Falls back to the
  // model's fixed `resolution` when no options are configured.
  const resolutionOpt = resolveQualityOption(
    modelRow.resolution_options,
    modelRow.default_resolution,
    typeof requestedResolution === "string" ? requestedResolution : null,
  );
  const resolution =
    resolutionOpt?.value ?? modelRow.resolution ?? "720p";
  const resolutionMultiplier = resolutionOpt?.multiplier ?? 1;

  const cost = Math.max(
    1,
    Math.round(
      (modelRow.tokens_per_generation * duration * resolutionMultiplier) /
        baseDuration,
    ),
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

  if (!isDevMode && !isAdmin && balance < cost) {
    throw createError({
      statusCode: 402,
      message: `Insufficient credits: this video requires ${cost} but you have ${balance}.`,
    });
  }

  const ratio = typeof aspectRatio === "string" ? aspectRatio : "16:9";
  // Gate each image slot by the model's capabilities.
  const firstFrameImageUrl = modelRow.supports_image_input
    ? (rawFirstFrame ?? null)
    : null;
  const referenceImageUrl = modelRow.supports_image_input
    ? (rawReference ?? null)
    : null;
  const lastFrameImageUrl = modelRow.supports_last_frame
    ? (rawLastFrame ?? null)
    : null;
  // Primary image stored in the dedicated column (for feed/detail display).
  const primaryImageUrl = firstFrameImageUrl ?? referenceImageUrl ?? null;

  // Placeholder clip used only in dev mode (public sample video).
  const DEV_SAMPLE_VIDEO =
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

  // --- Submit the async job to OpenRouter (skipped in dev mode) ---
  let jobId: string | null = null;
  let autoTags: string[] = [];
  if (!isDevMode) {
    let job;
    try {
      job = await submitVideoJob(openrouterKey, {
        model: modelId,
        prompt: trimmedPrompt,
        durationSeconds: duration,
        resolution,
        aspectRatio: ratio,
        firstFrameImageUrl,
        lastFrameImageUrl,
        referenceImageUrl,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit video job";
      throw createError({ statusCode: 502, message: msg });
    }
    jobId = job.id;
    autoTags = await inferTagsFromPrompt(openrouterKey, trimmedPrompt).catch(
      () => [] as string[],
    );
  }

  // --- Persist the row (completed immediately in dev mode) ---
  const { data: inserted, error: dbError } = await supabase
    .from("video_generations")
    .insert({
      user_id: user.id,
      prompt: trimmedPrompt,
      model_id: modelId,
      model_name: modelName,
      provider: "openrouter",
      job_id: jobId,
      status: isDevMode ? "completed" : "pending",
      output_video_url: isDevMode ? DEV_SAMPLE_VIDEO : null,
      input_image_url: primaryImageUrl,
      duration_seconds: duration,
      resolution,
      aspect_ratio: ratio,
      tokens_used: isDevMode ? 0 : cost,
      metadata: {
        tags: autoTags,
        ...(firstFrameImageUrl ? { first_frame_url: firstFrameImageUrl } : {}),
        ...(lastFrameImageUrl ? { last_frame_url: lastFrameImageUrl } : {}),
        ...(referenceImageUrl ? { reference_url: referenceImageUrl } : {}),
      },
    } as never)
    .select("id")
    .single();

  if (dbError) {
    throw createError({
      statusCode: 500,
      message: "Failed to save video generation",
    });
  }
  const generationId = (inserted as { id: string }).id;

  // --- Dev mode: return the finished mock immediately, no credits spent ---
  if (isDevMode) {
    return {
      generationId,
      status: "completed",
      videoUrl: DEV_SAMPLE_VIDEO,
      tokensUsed: 0,
    };
  }

  // --- Reserve credits now; refunded by the status endpoint if the job fails ---
  if (!isAdmin && cost > 0) {
    try {
      const { data: spent, error: spendErr } = await (supabase as any).rpc(
        "spend_tokens",
        { p_user_id: user.id, p_amount: cost },
      );
      if (spendErr || spent === false) {
        console.error(
          "[generate-video] Credit reserve failed (non-fatal):",
          spendErr ?? "insufficient balance at spend time",
        );
      } else {
        await (supabase as any).from("token_transactions").insert({
          user_id: user.id,
          amount: -cost,
          type: "video_generation",
          reference_id: generationId,
          description: `Video (${duration}s) with ${modelName}`,
        });
      }
    } catch (err) {
      console.error("[generate-video] Credit reserve failed (non-fatal):", err);
    }
  }

  const distinctId = getHeader(event, "x-posthog-distinct-id");
  const posthog = useServerPostHog();
  posthog.capture({
    distinctId: distinctId ?? user.id,
    event: "video_generation_submitted",
    properties: {
      model_id: modelId,
      model_name: modelName,
      duration_seconds: duration,
      resolution,
      tokens_used: cost,
      aspect_ratio: ratio,
      has_input_image: !!primaryImageUrl,
      has_last_frame: !!lastFrameImageUrl,
      has_reference: !!referenceImageUrl,
      generation_id: generationId,
    },
  });

  return { generationId, status: "pending", tokensUsed: cost };
});
