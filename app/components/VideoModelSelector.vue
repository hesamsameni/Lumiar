<script setup lang="ts">
import type { VideoModel } from "~/utils/videoModels";

const props = defineProps<{
  modelValue: VideoModel;
}>();

const emit = defineEmits<{
  "update:modelValue": [model: VideoModel];
}>();

const { models } = useVideoModels();

// Group by the model's *maker* (the company that built it, e.g. Google/OpenAI/
// ByteDance) — never by our internal serving route (OpenRouter or Google). The
// maker is inferred from the model name/id, so grouping stays correct even if
// the id is prefixed with the serving provider (e.g. "openrouter/sora-2-pro").
type CompanyMeta = { label: string; subtitle: string; logo: string | null };

const companyMeta: Record<string, CompanyMeta> = {
  google: { label: "Google", subtitle: "Veo family", logo: "/ai-logos/gemini.svg" },
  openai: { label: "OpenAI", subtitle: "Sora family", logo: "/ai-logos/openai.svg" },
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
};

const companyOrder = [
  "google",
  "openai",
  "bytedance",
  "alibaba",
  "kuaishou",
  "black-forest-labs",
  "x-ai",
];

// Prefixes that are serving providers, not makers — ignore them when deciding
// the maker from the id and fall back to name-based detection.
const SERVING_PREFIXES = new Set(["openrouter", "fal", "fal-ai", "replicate"]);

// Map raw maker id-prefixes to a canonical key.
const MAKER_ALIASES: Record<string, string> = {
  "bytedance-seed": "bytedance",
  "x": "x-ai",
  xai: "x-ai",
};

// Detect the maker from the model name/id via keyword matching.
function inferMaker(model: VideoModel): string {
  const prefix = (model.id.split("/")[0] ?? "").toLowerCase();
  const aliased = MAKER_ALIASES[prefix] ?? prefix;
  if (aliased && aliased in companyMeta && !SERVING_PREFIXES.has(aliased)) {
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

  return aliased || "other";
}

function metaFor(company: string): CompanyMeta {
  return (
    companyMeta[company] ?? {
      label: company.charAt(0).toUpperCase() + company.slice(1),
      subtitle: "",
      logo: null,
    }
  );
}

const groupedModels = computed(() => {
  const groups = new Map<string, VideoModel[]>();
  for (const model of models.value) {
    const company = inferMaker(model);
    if (!groups.has(company)) groups.set(company, []);
    groups.get(company)!.push(model);
  }

  // Known companies first (in preferred order), then any others.
  const orderedKeys = [
    ...companyOrder.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !companyOrder.includes(c)),
  ];

  return orderedKeys.map((company) => ({
    company,
    ...metaFor(company),
    models: groups.get(company)!,
  }));
});

// Track logos that fail to load (file not added yet) so we can fall back to an
// icon instead of showing a broken image.
const brokenLogos = ref<Set<string>>(new Set());

const openGroups = ref<Set<string>>(new Set());

function toggleGroup(company: string) {
  if (openGroups.value.has(company)) openGroups.value.delete(company);
  else openGroups.value.add(company);
}

// Open the first group + the selected model's group by default.
watch(
  [groupedModels, () => props.modelValue],
  ([groups, model]) => {
    if (groups[0]) openGroups.value.add(groups[0].company);
    if (model) openGroups.value.add(inferMaker(model));
  },
  { immediate: true },
);

const tierBadge: Record<string, string> = {
  high: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400",
  mid: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400",
  low: "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400",
};
const tierLabel: Record<string, string> = {
  high: "High",
  mid: "Mid",
  low: "Low",
};
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="group in groupedModels"
      :key="group.company"
      class="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
    >
      <!-- Group header (clickable to collapse/expand) -->
      <button
        class="w-full flex items-center gap-2.5 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors text-left"
        @click="toggleGroup(group.company)"
      >
        <LogoColorMode
          v-if="group.logo && !brokenLogos.has(group.company)"
          :src="group.logo"
          :alt="`${group.label} logo`"
          class="size-4 shrink-0"
          @error="brokenLogos.add(group.company)"
        />
        <UIcon
          v-else
          name="i-lucide-clapperboard"
          class="size-4 shrink-0 text-zinc-400"
        />
        <div class="flex-1 min-w-0">
          <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{{
            group.label
          }}</span>
          <span
            v-if="group.subtitle"
            class="text-xs text-zinc-400 dark:text-zinc-500 ml-2"
            >{{ group.subtitle }}</span
          >
        </div>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 text-zinc-400 transition-transform shrink-0"
          :class="openGroups.has(group.company) ? 'rotate-180' : ''"
        />
      </button>

      <!-- Models list -->
      <div
        v-if="openGroups.has(group.company)"
        class="divide-y divide-zinc-100 dark:divide-zinc-800"
      >
        <div
          v-for="model in group.models"
          :key="model.id"
          class="relative flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors"
          :class="
            modelValue.id === model.id
              ? 'bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10'
              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
          "
          @click="emit('update:modelValue', model)"
        >
          <span
            v-if="modelValue.id === model.id"
            class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-gradient-brand"
          />
          <div
            class="mt-1 size-3.5 rounded-full border-2 shrink-0 transition-all"
            :class="
              modelValue.id === model.id
                ? 'border-transparent bg-gradient-brand'
                : 'border-zinc-300 dark:border-zinc-600'
            "
          />

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span
                class="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-tight"
                >{{ model.name }}</span
              >
              <span
                v-if="model.recommended"
                class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
              >
                <UIcon name="i-lucide-star" class="size-2.5" />
                Recommended
              </span>
              <span
                class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                :class="tierBadge[model.tier]"
              >
                {{ tierLabel[model.tier] }}
              </span>
            </div>

            <p
              :title="model.description"
              class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-3"
            >
              {{ model.description }}
            </p>

            <div class="flex items-center gap-3 mt-1 flex-wrap">
              <span
                class="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500"
              >
                <UIcon name="i-lucide-zap" class="size-3 text-amber-500" />
                {{ model.tokens_per_generation }} credits
              </span>
              <span
                class="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500"
              >
                <UIcon name="i-lucide-clock" class="size-3" />
                {{ model.duration_seconds }}s
              </span>
              <span
                class="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500"
              >
                <UIcon name="i-lucide-monitor" class="size-3" />
                {{ model.resolution }}
              </span>
              <span
                v-if="model.supports_image_input"
                class="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500"
              >
                <UIcon name="i-lucide-image" class="size-3" />
                Img input
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
