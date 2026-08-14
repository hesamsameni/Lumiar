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
  supports_video_input: boolean;
  supports_audio_input: boolean;
  supports_audio_generation: boolean;
  max_references: number;
  max_reference_videos: number;
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
    // Explicit image slots.
    firstFrameUrl,
    lastFrameUrl,
    // Unified reference pool (images + videos).
    referenceUrls: rawReferenceUrls,
    // Legacy single-reference field (mapped below for backward compat).
    referenceUrl: legacySingleRef,
    // Audio input slot.
    inputAudioUrl: rawInputAudioUrl,
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

  // Build the reference URLs array (new array format or legacy single values).
  let incomingRefs: string[] = [];
  if (Array.isArray(rawReferenceUrls)) {
    incomingRefs = rawReferenceUrls.filter(
      (u: unknown): u is string => typeof u === "string" && u.length > 0,
    );
  } else if (typeof legacySingleRef === "string" && legacySingleRef) {
    incomingRefs = [legacySingleRef];
  } else if (legacyReference) {
    incomingRefs = [legacyReference];
  }

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
  if (trimmedPrompt.length > 5000) {
    throw createError({
      statusCode: 400,
      message: "Prompt is too long (max 5000 characters)",
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
      "tokens_per_generation, duration_seconds, supported_durations, resolution, resolution_options, default_resolution, supports_image_input, supports_last_frame, supports_video_input, supports_audio_input, supports_audio_generation, max_references, max_reference_videos",
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
  const resolution = resolutionOpt?.value ?? modelRow.resolution ?? "720p";
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
  const lastFrameImageUrl = modelRow.supports_last_frame
    ? (rawLastFrame ?? null)
    : null;
  // Gate and cap the unified reference pool with separate video sub-limit.
  const maxRefs = modelRow.max_references ?? 1;
  const maxVideos = modelRow.max_reference_videos ?? 0;
  const acceptsRefs =
    modelRow.supports_image_input || modelRow.supports_video_input;
  const gatedRefs: { url: string; mediaType: "image" | "video" }[] = [];
  if (acceptsRefs && maxRefs > 0) {
    let videoCount = 0;
    for (const url of incomingRefs) {
      if (gatedRefs.length >= maxRefs) break;
      const isVideo = /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url);
      if (isVideo) {
        if (!modelRow.supports_video_input || videoCount >= maxVideos) continue;
        videoCount++;
      }
      gatedRefs.push({ url, mediaType: isVideo ? "video" : "image" });
    }
  }
  // Gate audio input by model capabilities.
  const inputAudioUrl =
    modelRow.supports_audio_input && typeof rawInputAudioUrl === "string"
      ? rawInputAudioUrl
      : null;
  const generateAudio = !!modelRow.supports_audio_generation;
  // Primary image stored in the dedicated column (for feed/detail display).
  const firstRefImage = gatedRefs.find((r) => r.mediaType === "image");
  const primaryImageUrl = firstFrameImageUrl ?? firstRefImage?.url ?? null;

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
        references: gatedRefs,
        inputAudioUrl,
        generateAudio,
      });
    } catch (err: unknown) {
      const raw =
        err instanceof Error ? err.message : "Failed to submit video job";
      // Surface a user-friendly message for known provider moderation errors.
      const msg = friendlyVideoError(raw);
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
      input_video_url:
        gatedRefs.find((r) => r.mediaType === "video")?.url ?? null,
      input_audio_url: inputAudioUrl,
      duration_seconds: duration,
      resolution,
      aspect_ratio: ratio,
      tokens_used: isDevMode ? 0 : cost,
      metadata: {
        tags: autoTags,
        ...(firstFrameImageUrl ? { first_frame_url: firstFrameImageUrl } : {}),
        ...(lastFrameImageUrl ? { last_frame_url: lastFrameImageUrl } : {}),
        ...(gatedRefs.length ? { references: gatedRefs } : {}),
        ...(inputAudioUrl ? { input_audio_url: inputAudioUrl } : {}),
        ...(generateAudio ? { generate_audio: true } : {}),
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
      reference_count: gatedRefs.length,
      has_input_audio: !!inputAudioUrl,
      generate_audio: generateAudio,
      generation_id: generationId,
    },
  });

  return { generationId, status: "pending", tokensUsed: cost };
});

// Map common provider error codes to user-friendly messages.
function friendlyVideoError(raw: string): string {
  if (
    raw.includes("SensitiveContentDetected") ||
    raw.includes("PrivacyInformation")
  ) {
    return "The input was rejected because it may contain a real person. Some video models do not allow real-person imagery — try a different model or use an illustrated/animated input.";
  }
  if (
    raw.includes("ContentPolicyViolation") ||
    raw.includes("content_policy")
  ) {
    return "The request was rejected by the provider's content policy. Try adjusting your prompt or input media.";
  }
  if (raw.includes("SAFETY")) {
    return "The request was blocked by the provider's safety filter. Try a different prompt or input.";
  }
  // Fall back to the raw error but try to extract a readable message.
  // The raw string may contain nested JSON with escaped quotes, e.g.
  // `OpenRouter video submit failed (400): {"error":{"message":"model \"x\" not found"}}`
  // so we try to parse the JSON body first.
  try {
    const jsonStart = raw.indexOf("{");
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const msg =
        parsed?.error?.message ??
        parsed?.message ??
        parsed?.error?.error?.message;
      if (typeof msg === "string" && msg.length > 0) return msg;
    }
  } catch {
    // JSON parse failed — fall through to raw.
  }
  return raw;
}
