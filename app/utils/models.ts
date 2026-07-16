import { creditsForOption, type QualityOption } from "./quality";

export type ModelTier = "low" | "mid" | "high";
export type ModelProvider = "openai" | "openrouter" | "google";

export interface AIModel {
  id: string;
  name: string;
  description: string;
  tier: ModelTier;
  provider: ModelProvider;
  tokens_per_generation: number;
  price_estimate: string;
  supports_image_input: boolean;
  max_image_inputs: number;
  max_resolution?: string | null;
  // Selectable quality tiers (empty = no quality control). See utils/quality.ts.
  quality_options?: QualityOption[];
  default_quality?: string | null;
  recommended?: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// Credits for an image generation at the selected quality tier. `quality` is a
// selectable value or "auto"/undefined to use the model default.
export function imageCreditsForQuality(
  model: Pick<
    AIModel,
    "tokens_per_generation" | "quality_options" | "default_quality"
  >,
  quality?: string | null,
): number {
  return creditsForOption(
    model.tokens_per_generation,
    model.quality_options,
    model.default_quality,
    quality,
  );
}

export const TIER_CONFIG: Record<ModelTier, { label: string; color: string }> =
  {
    high: { label: "High Tier", color: "amber" },
    mid: { label: "Mid Tier", color: "blue" },
    low: { label: "Low Tier", color: "green" },
  };
