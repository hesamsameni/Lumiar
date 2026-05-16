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
  max_resolution?: string | null;
  recommended?: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export const TIER_CONFIG: Record<ModelTier, { label: string; color: string }> =
  {
    high: { label: "High Tier", color: "amber" },
    mid: { label: "Mid Tier", color: "blue" },
    low: { label: "Low Tier", color: "green" },
  };
