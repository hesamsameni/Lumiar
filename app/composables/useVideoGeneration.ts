import type { VideoModel } from "~/utils/videoModels";
import { videoCredits } from "~/utils/videoModels";
import { compressImage } from "~/utils/imageCompression";
import { captureVideoFrame } from "~/utils/videoThumbnail";

export interface VideoGenerationResult {
  videoUrl: string;
  thumbnailUrl: string;
  generationId: string;
}

const POLL_INTERVAL_MS = 12_000;
const MAX_POLL_ATTEMPTS = 50; // ~10 min

export function useVideoGeneration() {
  const { profile } = useProfile();
  const supabase = useSupabaseClient();
  const toast = useToast();
  const { fetchBalance } = useTokens();
  const posthog = usePostHog();

  const isGenerating = ref(false);
  const result = ref<VideoGenerationResult | null>(null);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Not authenticated");
    return { Authorization: `Bearer ${token}` };
  }

  async function generate(opts: {
    prompt: string;
    model: VideoModel;
    durationSeconds?: number;
    resolution?: string | null;
    firstFrameFile?: File | null;
    lastFrameFile?: File | null;
    // Already-hosted images picked from the bucket / past generations.
    firstFrameUrl?: string | null;
    lastFrameUrl?: string | null;
    // Unified reference pool (images + videos). Each entry is either a
    // device file to upload or an already-hosted URL.
    referenceFiles?: File[];
    referenceUrls?: string[];
    // Audio input file (uploaded raw, no compression).
    inputAudioFile?: File | null;
    aspectRatio?: string;
  }) {
    if (!profile.value?.id) {
      toast.add({
        title: "Sign in required",
        description: "Please sign in to generate videos.",
        color: "error",
      });
      return null;
    }

    const duration = opts.durationSeconds ?? opts.model.duration_seconds;
    const cost = videoCredits(opts.model, duration, opts.resolution);

    const balance = profile.value.token_balance ?? 0;
    if (!profile.value.is_admin && balance < cost) {
      toast.add({
        title: "Insufficient credits",
        description: `This generation requires ${cost} credits but you only have ${balance}. Purchase more credits to continue.`,
        color: "warning",
      });
      return null;
    }

    isGenerating.value = true;
    result.value = null;

    posthog?.capture("video_generation_started", {
      model_name: opts.model.name,
      model_id: opts.model.id,
      credits_required: cost,
      duration_seconds: duration,
      has_input_images: !!(
        opts.firstFrameFile ||
        opts.lastFrameFile ||
        opts.firstFrameUrl ||
        opts.lastFrameUrl ||
        (opts.referenceFiles?.length ?? 0) > 0 ||
        (opts.referenceUrls?.length ?? 0) > 0
      ),
      reference_count:
        (opts.referenceFiles?.length ?? 0) + (opts.referenceUrls?.length ?? 0),
      has_input_audio: !!opts.inputAudioFile,
      aspect_ratio: opts.aspectRatio ?? "16:9",
    });

    try {
      const headers = await authHeaders();

      // Resolve a slot to a hosted URL: prefer an already-hosted pick, else
      // upload the device file to R2 so OpenRouter can fetch it.
      async function resolveSlot(
        file: File | null | undefined,
        existingUrl: string | null | undefined,
      ) {
        if (existingUrl) return existingUrl;
        if (!file) return null;
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("file", compressed);
        const uploadRes = await $fetch<{ url: string }>("/api/upload", {
          method: "POST",
          body: fd,
          headers,
        });
        return uploadRes.url;
      }

      // Upload raw video/audio files (no compression) to temporary R2 folders.
      async function uploadRawFile(
        file: File | null | undefined,
        folder: string,
      ): Promise<string | null> {
        if (!file) return null;
        const fd = new FormData();
        fd.append("file", file);
        const uploadRes = await $fetch<{ url: string }>(
          `/api/upload?folder=${folder}`,
          { method: "POST", body: fd, headers },
        );
        return uploadRes.url;
      }

      // Resolve frame anchors + audio in parallel.
      const [firstFrameUrl, lastFrameUrl, inputAudioUrl] = await Promise.all([
        resolveSlot(opts.firstFrameFile, opts.firstFrameUrl),
        resolveSlot(opts.lastFrameFile, opts.lastFrameUrl),
        uploadRawFile(opts.inputAudioFile, "tmp-audio"),
      ]);

      // Resolve unified reference pool (files → upload, URLs → pass through).
      const refFileUploads = (opts.referenceFiles ?? []).map(async (file) => {
        const isVideo = file.type.startsWith("video/");
        if (isVideo) {
          return uploadRawFile(file, "tmp-video");
        }
        return resolveSlot(file, null);
      });
      const uploadedRefUrls = await Promise.all(refFileUploads);
      const referenceUrls: string[] = [
        ...uploadedRefUrls.filter((u): u is string => !!u),
        ...(opts.referenceUrls ?? []),
      ];

      const submit = await $fetch<{
        generationId: string;
        status: string;
        videoUrl?: string;
      }>("/api/generate-video", {
        method: "POST",
        headers,
        body: {
          prompt: opts.prompt,
          modelId: opts.model.id,
          modelName: opts.model.name,
          durationSeconds: duration,
          resolution: opts.resolution ?? "auto",
          aspectRatio: opts.aspectRatio ?? "16:9",
          firstFrameUrl,
          lastFrameUrl,
          referenceUrls,
          inputAudioUrl,
        },
      });

      // Balance was reserved server-side; reflect it immediately.
      await fetchBalance();

      // Dev mode returns an already-finished clip — skip polling.
      if (submit.status === "completed" && submit.videoUrl) {
        return complete(submit.generationId, submit.videoUrl);
      }

      const finalResult = await pollUntilDone(submit.generationId);
      return finalResult;
    } catch (err: unknown) {
      const raw =
        (err as { data?: { message?: string } })?.data?.message ??
        (err instanceof Error ? err.message : "Generation failed");
      toast.add({
        title: "Generation failed",
        description: raw,
        color: "error",
      });
      isGenerating.value = false;
      return null;
    }
  }

  // Capture a poster frame from the finished clip and store it as the video's
  // thumbnail so feeds show a real cover. Best-effort — failures are ignored.
  async function generateThumbnail(generationId: string, videoUrl: string) {
    try {
      const blob = await captureVideoFrame(videoUrl);
      if (!blob) return;
      const headers = await authHeaders();
      const fd = new FormData();
      fd.append(
        "file",
        new File([blob], `thumb-${generationId}.jpg`, { type: "image/jpeg" }),
      );
      const uploadRes = await $fetch<{ url: string }>("/api/upload", {
        method: "POST",
        body: fd,
        headers,
      });
      await (supabase as any)
        .from("video_generations")
        .update({ thumbnail_url: uploadRes.url })
        .eq("id", generationId);
      if (result.value?.generationId === generationId) {
        result.value = { ...result.value, thumbnailUrl: uploadRes.url };
      }
    } catch {
      // best-effort — keep the placeholder cover
    }
  }

  function complete(generationId: string, videoUrl: string) {
    result.value = { videoUrl, thumbnailUrl: "", generationId };
    isGenerating.value = false;
    fetchBalance();
    posthog?.capture("video_generation_completed", {
      generation_id: generationId,
    });
    toast.add({ title: "Video generated!", color: "success" });
    // Fire-and-forget: generate + persist a poster frame.
    generateThumbnail(generationId, videoUrl);
    return result.value;
  }

  function fail(generationId: string, error?: string | null) {
    isGenerating.value = false;
    fetchBalance(); // credits were refunded server-side
    toast.add({
      title: "Generation failed",
      description:
        error ??
        "The video could not be generated. Your credits were refunded.",
      color: "error",
    });
    posthog?.capture("video_generation_failed", {
      generation_id: generationId,
    });
    return null;
  }

  async function pollUntilDone(
    generationId: string,
  ): Promise<VideoGenerationResult | null> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      // Trigger server-side finalization (download -> R2). Best-effort: this
      // request can be slow while it stores the clip, so we don't rely on
      // catching its response — the DB row below is the source of truth.
      let statusResp: {
        status?: string;
        videoUrl?: string | null;
        error?: string | null;
      } | null = null;
      try {
        const headers = await authHeaders();
        statusResp = await $fetch(
          `/api/video-generations/${generationId}/status`,
          { headers },
        );
      } catch {
        statusResp = null;
      }

      // Authoritative check straight from the row (survives flaky responses).
      const { data: row } = (await (supabase as any)
        .from("video_generations")
        .select("status, output_video_url, error")
        .eq("id", generationId)
        .maybeSingle()) as {
        data: {
          status: string;
          output_video_url: string | null;
          error: string | null;
        } | null;
      };

      const videoUrl = statusResp?.videoUrl ?? row?.output_video_url ?? null;
      const isDone =
        statusResp?.status === "completed" || row?.status === "completed";
      if (isDone && videoUrl) {
        return complete(generationId, videoUrl);
      }

      const isFailed =
        statusResp?.status === "failed" || row?.status === "failed";
      if (isFailed) {
        return fail(generationId, statusResp?.error ?? row?.error);
      }
    }

    // Timed out waiting — the job may still finish; it'll show in the profile.
    isGenerating.value = false;
    toast.add({
      title: "Still generating…",
      description:
        "This is taking a while. Your video will appear in your profile when it's ready.",
      color: "info",
      duration: 8000,
    });
    return null;
  }

  return { generate, isGenerating, result };
}
