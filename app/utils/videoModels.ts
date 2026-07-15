export type VideoModelTier = "low" | "mid" | "high";

// Internal serving route for a video model. All video models are served through
// OpenRouter (including Google's Veo). NOT shown to users — the UI groups models
// by their maker (see `id` prefix), never by this.
export type VideoProvider = "openrouter";

export interface VideoModel {
  // Prefixed by the model MAKER so the picker can group by brand + logo, e.g.
  // "google/veo-3.1", "bytedance/seedance-1.5-pro", "openai/sora-2-pro".
  id: string;
  name: string;
  description: string;
  tier: VideoModelTier;
  provider: VideoProvider;
  // Flat credit cost per generation. The clip length is fixed per model
  // (see `duration_seconds`) so this stays a simple flat price.
  tokens_per_generation: number;
  // Human-readable provider cost estimate, e.g. "~$2.50 / clip". Display only.
  price_estimate: string;
  // Default output clip length in seconds.
  duration_seconds: number;
  // Clip lengths (seconds) the user can choose from. Credits scale linearly
  // with duration (video providers bill per second).
  supported_durations: number[];
  // Output resolution label, e.g. "720p" | "1080p".
  resolution: string;
  // Whether the model accepts a reference image (image-to-video).
  supports_image_input: boolean;
  supported_aspect_ratios: string[];
  recommended?: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export const VIDEO_TIER_CONFIG: Record<
  VideoModelTier,
  { label: string; color: string }
> = {
  high: { label: "High Tier", color: "amber" },
  mid: { label: "Mid Tier", color: "blue" },
  low: { label: "Low Tier", color: "green" },
};

// Credits for a given clip length. `tokens_per_generation` is the cost at the
// model's default `duration_seconds`; cost scales linearly with duration to
// mirror providers' per-second billing.
export function videoCreditsForDuration(
  model: Pick<VideoModel, "tokens_per_generation" | "duration_seconds">,
  seconds: number,
): number {
  const base = model.duration_seconds || 1;
  return Math.max(
    1,
    Math.round((model.tokens_per_generation * seconds) / base),
  );
}
