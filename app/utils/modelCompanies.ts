import type { AIModel } from "./models";
import type { VideoModel } from "./videoModels";

export type CompanyMeta = {
  label: string;
  subtitle: string;
  logo: string | null;
};

export type CompanyGroup<T> = CompanyMeta & {
  company: string;
  models: T[];
};

export const TIER_BADGE: Record<string, string> = {
  high: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400",
  mid: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400",
  low: "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400",
};

export const TIER_LABEL: Record<string, string> = {
  high: "High",
  mid: "Mid",
  low: "Low",
};

// --- Image models -----------------------------------------------------------

export const IMAGE_COMPANY_META: Record<string, CompanyMeta> = {
  google: {
    label: "Google",
    subtitle: "Nano Banana family",
    logo: "/ai-logos/gemini.svg",
  },
  openai: {
    label: "OpenAI",
    subtitle: "GPT Image family",
    logo: "/ai-logos/openai.svg",
  },
  recraft: {
    label: "Recraft",
    subtitle: "Recraft V3 / V4 family",
    logo: "/ai-logos/recraft.svg",
  },
  "black-forest-labs": {
    label: "Black Forest Labs",
    subtitle: "FLUX family",
    logo: "/ai-logos/flux.svg",
  },
  bytedance: {
    label: "Bytedance",
    subtitle: "Bytedance family",
    logo: "/ai-logos/bytedance.svg",
  },
  "x-ai": {
    label: "xAI",
    subtitle: "Grok Imagine family",
    logo: "/ai-logos/xai.svg",
  },
  microsoft: {
    label: "Microsoft",
    subtitle: "MAI Image family",
    logo: "/ai-logos/microsoft.svg",
  },
  sourceful: {
    label: "Sourceful",
    subtitle: "Riverflow family",
    logo: "/ai-logos/sourceful.jpeg",
  },
  krea: {
    label: "Krea",
    subtitle: "Krea 2 family",
    logo: "/ai-logos/krea.svg",
  },
};

export const IMAGE_COMPANY_ORDER = [
  "google",
  "openai",
  "microsoft",
  "recraft",
  "black-forest-labs",
  "bytedance",
  "x-ai",
  "sourceful",
  "krea",
];

const IMAGE_COMPANY_ID_MAP: Record<string, string> = {
  "bytedance-seed": "bytedance",
};

export function inferImageMaker(model: Pick<AIModel, "id">): string {
  const prefix = model.id.split("/")[0] ?? "";
  return IMAGE_COMPANY_ID_MAP[prefix] ?? prefix;
}

export function groupImageModels(models: AIModel[]): CompanyGroup<AIModel>[] {
  const groups: Record<string, AIModel[]> = {};
  for (const key of IMAGE_COMPANY_ORDER) groups[key] = [];

  for (const model of models) {
    const company = inferImageMaker(model);
    if (!(company in groups)) groups[company] = [];
    groups[company]!.push(model);
  }

  const orderedKeys = [
    ...IMAGE_COMPANY_ORDER.filter((c) => (groups[c]?.length ?? 0) > 0),
    ...Object.keys(groups).filter(
      (c) => !IMAGE_COMPANY_ORDER.includes(c) && (groups[c]?.length ?? 0) > 0,
    ),
  ];

  return orderedKeys.map((company) => ({
    company,
    ...(IMAGE_COMPANY_META[company] ?? fallbackMeta(company)),
    models: groups[company]!,
  }));
}

// --- Video models -----------------------------------------------------------

export const VIDEO_COMPANY_META: Record<string, CompanyMeta> = {
  google: {
    label: "Google",
    subtitle: "Veo family",
    logo: "/ai-logos/gemini.svg",
  },
  openai: {
    label: "OpenAI",
    subtitle: "Sora family",
    logo: "/ai-logos/openai.svg",
  },
  bytedance: {
    label: "Bytedance",
    subtitle: "Seedance family",
    logo: "/ai-logos/bytedance.svg",
  },
  "black-forest-labs": {
    label: "Black Forest Labs",
    subtitle: "FLUX family",
    logo: "/ai-logos/flux.svg",
  },
  "x-ai": { label: "xAI", subtitle: "Grok family", logo: "/ai-logos/xai.svg" },
  alibaba: {
    label: "Alibaba",
    subtitle: "Wan · HappyHorse",
    logo: "/ai-logos/alibaba.svg",
  },
  kuaishou: {
    label: "Kuaishou",
    subtitle: "Kling family",
    logo: "/ai-logos/kuaishou.svg",
  },
  minimax: {
    label: "MiniMax",
    subtitle: "Hailuo family",
    logo: "/ai-logos/minimax.svg",
  },
  runway: {
    label: "Runway",
    subtitle: "Gen · Aleph",
    logo: "/ai-logos/runway.svg",
  },
};

export const VIDEO_COMPANY_ORDER = [
  "google",
  "openai",
  "bytedance",
  "alibaba",
  "kuaishou",
  "black-forest-labs",
  "x-ai",
  "runway",
];

const SERVING_PREFIXES = new Set(["openrouter", "fal", "fal-ai", "replicate"]);

const MAKER_ALIASES: Record<string, string> = {
  "bytedance-seed": "bytedance",
  x: "x-ai",
  xai: "x-ai",
};

export function inferVideoMaker(
  model: Pick<VideoModel, "id" | "name">,
): string {
  const prefix = (model.id.split("/")[0] ?? "").toLowerCase();
  const aliased = MAKER_ALIASES[prefix] ?? prefix;
  if (aliased && aliased in VIDEO_COMPANY_META && !SERVING_PREFIXES.has(aliased)) {
    return aliased;
  }

  const text = `${model.name} ${model.id}`.toLowerCase();
  if (/veo|imagen|gemini|nano.?banana/.test(text)) return "google";
  if (/sora|gpt|dall.?e/.test(text)) return "openai";
  if (/seedance|seedream|bytedance/.test(text)) return "bytedance";
  if (/\bwan\b|alibaba|tongyi|qwen/.test(text)) return "alibaba";
  if (/kling|kuaishou/.test(text)) return "kuaishou";
  if (/flux|black.?forest/.test(text)) return "black-forest-labs";
  if (/grok|x-?ai/.test(text)) return "x-ai";
  if (/hailuo|minimax/.test(text)) return "minimax";

  return aliased || "other";
}

export function groupVideoModels(
  models: VideoModel[],
): CompanyGroup<VideoModel>[] {
  const groups = new Map<string, VideoModel[]>();
  for (const model of models) {
    const company = inferVideoMaker(model);
    if (!groups.has(company)) groups.set(company, []);
    groups.get(company)!.push(model);
  }

  const orderedKeys = [
    ...VIDEO_COMPANY_ORDER.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !VIDEO_COMPANY_ORDER.includes(c)),
  ];

  return orderedKeys.map((company) => ({
    company,
    ...(VIDEO_COMPANY_META[company] ?? fallbackMeta(company)),
    models: groups.get(company)!,
  }));
}

export function modelExplorerPath(
  type: "image" | "video",
  modelId: string,
): string {
  return `/models/${type}/${modelId}`;
}

function fallbackMeta(company: string): CompanyMeta {
  return {
    label: company.charAt(0).toUpperCase() + company.slice(1),
    subtitle: "",
    logo: null,
  };
}
