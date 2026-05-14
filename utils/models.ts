export type ModelTier = "low" | "mid" | "high";

export interface AIModel {
  id: string;
  name: string;
  description: string;
  tier: ModelTier;
  tokensPerGeneration: number;
  priceEstimate: string;
  supportsImageInput: boolean;
  maxResolution?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "recraft/recraft-v4-pro",
    name: "Recraft V4 Pro",
    description:
      "Highest fidelity image generation — 2K resolution, supports image-to-image editing",
    tier: "high",
    tokensPerGeneration: 12,
    priceEstimate: "~$0.25/image",
    supportsImageInput: true,
    maxResolution: "2048×2048",
  },
  {
    id: "recraft/recraft-v4",
    name: "Recraft V4",
    description:
      "Strong compositional quality, color coherence — great for product and editorial",
    tier: "mid",
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
    tokensPerGeneration: 5,
    priceEstimate: "~$0.04/image",
    supportsImageInput: true,
    maxResolution: "1024×1024",
  },
  {
    id: "google/gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash Image",
    description:
      "Google Gemini — fast, affordable, supports image input and multiple aspect ratios",
    tier: "low",
    tokensPerGeneration: 3,
    priceEstimate: "Usage-based",
    supportsImageInput: true,
    maxResolution: "1024×1024",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash Image",
    description:
      "Latest Gemini image model — extended aspect ratios, image input, fast generation",
    tier: "low",
    tokensPerGeneration: 3,
    priceEstimate: "Usage-based",
    supportsImageInput: true,
    maxResolution: "1024×1024",
  },
  {
    id: "black-forest-labs/flux.2-pro",
    name: "Flux.2 Pro",
    description:
      "Black Forest Labs flagship — photorealistic, stunning detail and sharpness",
    tier: "high",
    tokensPerGeneration: 10,
    priceEstimate: "Usage-based",
    supportsImageInput: false,
    maxResolution: "1440×1440",
  },
  {
    id: "black-forest-labs/flux.2-flex",
    name: "Flux.2 Flex",
    description:
      "Flexible resolution Flux — good quality at variable output sizes",
    tier: "mid",
    tokensPerGeneration: 4,
    priceEstimate: "Usage-based",
    supportsImageInput: false,
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
