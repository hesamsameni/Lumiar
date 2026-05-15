export const ASPECT_RATIOS = [
  { label: "Auto", value: "auto", width: 1024, height: 1024 },
  { label: "Square (1:1)", value: "1:1", width: 1024, height: 1024 },
  { label: "Portrait (2:3)", value: "2:3", width: 832, height: 1216 },
  { label: "Landscape (3:2)", value: "3:2", width: 1216, height: 832 },
  { label: "Wide (16:9)", value: "16:9", width: 1280, height: 720 },
  { label: "Tall (9:16)", value: "9:16", width: 720, height: 1280 },
];

export const PROMPT_POLISH_MODEL = "openai/gpt-4o-mini";

export const FREE_WELCOME_TOKENS = 10;

export const TOKEN_PACKS = [
  { id: "pack_50", tokens: 50, price: 4.99, label: "50 Tokens" },
  {
    id: "pack_150",
    tokens: 150,
    price: 12.99,
    label: "150 Tokens",
    badge: "Popular",
  },
  {
    id: "pack_500",
    tokens: 500,
    price: 39.99,
    label: "500 Tokens",
    badge: "Best Value",
  },
];

export const GENERATION_TAGS = [
  "portrait",
  "landscape",
  "abstract",
  "anime",
  "photorealistic",
  "concept art",
  "illustration",
  "logo",
  "architecture",
  "nature",
  "fantasy",
  "sci-fi",
  "vintage",
  "minimalist",
  "surreal",
  "product",
  "food",
  "fashion",
  "interior",
  "dark art",
];
