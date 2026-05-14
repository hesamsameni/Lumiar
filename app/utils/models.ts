export type ModelTier = "low" | "mid" | "high";
export type ModelProvider = "openai" | "openrouter";

export interface AIModel {
  id: string;
  name: string;
  description: string;
  tier: ModelTier;
  /** Internal field — determines which API backend to use */
  provider: ModelProvider;
  tokensPerGeneration: number;
  priceEstimate: string;
  supportsImageInput: boolean;
  maxResolution?: string;
  recommended?: boolean;
}

export const AI_MODELS: AIModel[] = [
  // —— OpenAI models (direct API) ——
  {
    id: "openai/gpt-image-2",
    name: "GPT Image 2",
    description:
      "Latest OpenAI image model — highest fidelity, up to 4K resolution, great for editing",
    tier: "high",
    provider: "openai",
    tokensPerGeneration: 15,
    priceEstimate: "~$0.053/image",
    supportsImageInput: true,
    maxResolution: "4096×4096",
    recommended: true,
  },
  {
    id: "openai/gpt-image-1",
    name: "GPT Image 1",
    description:
      "OpenAI image model — reliable quality, excellent prompt adherence and editing",
    tier: "high",
    provider: "openai",
    tokensPerGeneration: 10,
    priceEstimate: "~$0.042/image",
    supportsImageInput: true,
    maxResolution: "1536×1536",
  },
  {
    id: "openai/gpt-image-1-mini",
    name: "GPT Image 1 Mini",
    description:
      "Fast and affordable OpenAI image model — great for quick drafts and iteration",
    tier: "low",
    provider: "openai",
    tokensPerGeneration: 3,
    priceEstimate: "~$0.011/image",
    supportsImageInput: true,
    maxResolution: "1024×1024",
  },
  // —— OpenRouter models ——
  {
    id: "recraft/recraft-v4-pro",
    name: "Recraft V4 Pro",
    description:
      "Highest fidelity image generation — 2K resolution, supports image-to-image editing",
    tier: "high",
    provider: "openrouter",
    tokensPerGeneration: 12,
    priceEstimate: "~$0.09/image",
    supportsImageInput: true,
    maxResolution: "2048×2048",
  },
  {
    id: "recraft/recraft-v4",
    name: "Recraft V4",
    description:
      "Strong compositional quality, color coherence — great for product and editorial",
    tier: "mid",
    provider: "openrouter",
    tokensPerGeneration: 5,
    priceEstimate: "~$0.04/image",
    supportsImageInput: true,
    maxResolution: "1024×1024",
  },
  {
    id: "recraft/recraft-v3",
    name: "Recraft V3",
    description:
      "Artistic styles, color palettes and text layout — supports image input",
    tier: "mid",
    provider: "openrouter",
    tokensPerGeneration: 5,
    priceEstimate: "~$0.04/image",
    supportsImageInput: true,
    maxResolution: "1024×1024",
  },
  {
    id: "google/gemini-2.5-flash-image",
    name: "Nano Banana",
    description:
      "Fast and affordable Gemini image model with image input and multiple aspect ratios",
    tier: "low",
    provider: "openrouter",
    tokensPerGeneration: 3,
    priceEstimate: "~$0.01/image",
    supportsImageInput: true,
    maxResolution: "1024×1024",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    name: "Nano Banana 2",
    description:
      "Latest Gemini image model — extended aspect ratios, higher quality, image input",
    tier: "mid",
    provider: "openrouter",
    tokensPerGeneration: 5,
    priceEstimate: "~$0.02/image",
    supportsImageInput: true,
    maxResolution: "1024×1024",
    recommended: true,
  },
  {
    id: "black-forest-labs/flux.2-pro",
    name: "Flux.2 Pro",
    description:
      "Black Forest Labs flagship — photorealistic, stunning detail and sharpness",
    tier: "high",
    provider: "openrouter",
    tokensPerGeneration: 10,
    priceEstimate: "~$0.055/image",
    supportsImageInput: true,
    maxResolution: "1440×1440",
  },
  {
    id: "black-forest-labs/flux.2-flex",
    name: "Flux.2 Flex",
    description:
      "Flexible resolution Flux — good quality at variable output sizes",
    tier: "mid",
    provider: "openrouter",
    tokensPerGeneration: 4,
    priceEstimate: "~$0.01/image",
    supportsImageInput: true,
    maxResolution: "1024×1024",
  },
];

export const TIER_CONFIG: Record<ModelTier, { label: string; color: string }> =
  {
    high: { label: "High Tier", color: "amber" },
    mid: { label: "Mid Tier", color: "blue" },
    low: { label: "Low Tier", color: "green" },
  };

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}
