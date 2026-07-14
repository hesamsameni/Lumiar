import type { VideoModel } from "~/utils/videoModels";

// Front-end placeholder catalog. The real list will come from `/api/video-models`
// (backend) once video providers are wired up. Credit costs are set to stay
// profitable vs. OpenRouter/Google video pricing (verified Jul 2026):
// worst-case revenue ~= $0.0083/credit, targeting ~2x provider cost.
// NOTE: `id` is prefixed by the model *maker* (google/bytedance/openai) so the
// UI can group by brand. `provider` is the internal serving route (openrouter
// or google) and is never shown to users.
export const MOCK_VIDEO_MODELS: VideoModel[] = [
  {
    id: "google/veo-3.1-fast",
    name: "Veo 3.1 Fast",
    description:
      "Fast, affordable 5s clips with audio. Great for quick iterations and social content.",
    tier: "mid",
    provider: "openrouter",
    tokens_per_generation: 180,
    price_estimate: "~$0.12/s",
    duration_seconds: 6,
    supported_durations: [4, 6, 8],
    resolution: "1080p",
    supports_image_input: true,
    supported_aspect_ratios: ["16:9", "9:16"],
    recommended: true,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "bytedance/seedance-1-5-pro",
    name: "Seedance 1.5 Pro",
    description:
      "Balanced quality and motion. Solid all-rounder for narrative shots.",
    tier: "mid",
    provider: "openrouter",
    tokens_per_generation: 150,
    price_estimate: "~$0.12/s",
    duration_seconds: 5,
    supported_durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    resolution: "1080p",
    supports_image_input: true,
    supported_aspect_ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    is_active: true,
    sort_order: 2,
  },
  {
    id: "google/veo-3.1",
    name: "Veo 3.1",
    description:
      "Highest fidelity 1080p video with cinematic motion and synchronized audio.",
    tier: "high",
    provider: "openrouter",
    tokens_per_generation: 600,
    price_estimate: "~$0.40/s",
    duration_seconds: 6,
    supported_durations: [4, 6, 8],
    resolution: "1080p",
    supports_image_input: true,
    supported_aspect_ratios: ["16:9", "9:16"],
    is_active: true,
    sort_order: 3,
  },
];

export function useVideoModels() {
  const models = useState<VideoModel[]>("video-models", () => []);
  const loading = useState<boolean>("video-models-loading", () => false);
  const error = useState<string | null>("video-models-error", () => null);

  async function fetchVideoModels() {
    if (loading.value || models.value.length) return;
    loading.value = true;
    error.value = null;

    try {
      // Backend endpoint not built yet — fall back to the mock catalog so the
      // UI is fully functional in the meantime.
      const data = await $fetch<VideoModel[]>("/api/video-models").catch(
        () => null,
      );
      models.value = data?.length ? data : MOCK_VIDEO_MODELS;
    } catch (err: unknown) {
      error.value =
        err instanceof Error ? err.message : "Failed to load video models";
      models.value = MOCK_VIDEO_MODELS;
    } finally {
      loading.value = false;
    }
  }

  const firstModel = computed<VideoModel | undefined>(
    () => models.value.find((m) => m.recommended) ?? models.value[0],
  );

  function getModelById(id: string): VideoModel | undefined {
    return models.value.find((m) => m.id === id);
  }

  return {
    models,
    loading,
    error,
    fetchVideoModels,
    firstModel,
    getModelById,
  };
}
