<script setup lang="ts">
import type { AIModel } from "~/utils/models";

const props = defineProps<{
  modelValue: AIModel;
  defaultModelId?: string | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [model: AIModel];
  "set-default": [modelId: string | null];
}>();

const { models } = useModels();

type CompanyKey =
  | "openai"
  | "google"
  | "recraft"
  | "black-forest-labs"
  | "bytedance"
  | "x-ai"
  | "microsoft"
  | "sourceful";

const companyMeta: Record<
  CompanyKey,
  { label: string; subtitle: string; logo: string }
> = {
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
};

const companyOrder: CompanyKey[] = [
  "google",
  "openai",
  "microsoft",
  "recraft",
  "black-forest-labs",
  "bytedance",
  "x-ai",
  "sourceful",
];

const COMPANY_ID_MAP: Partial<Record<string, CompanyKey>> = {
  "bytedance-seed": "bytedance",
};

const groupedModels = computed(() => {
  const groups: Record<CompanyKey, AIModel[]> = {
    openai: [],
    google: [],
    microsoft: [],
    recraft: [],
    "black-forest-labs": [],
    bytedance: [],
    "x-ai": [],
    sourceful: [],
  };
  for (const model of models.value) {
    const prefix = model.id.split("/")[0] ?? "";
    const company = (COMPANY_ID_MAP[prefix] ?? prefix) as CompanyKey;
    if (company in groups) groups[company].push(model);
  }
  return companyOrder
    .map((company) => ({
      company,
      ...companyMeta[company],
      models: groups[company],
    }))
    .filter((g) => g.models.length > 0);
});

// First group open by default, rest collapsed
const openGroups = ref<Set<CompanyKey>>(
  new Set<CompanyKey>([companyOrder[0] as CompanyKey]),
);

function toggleGroup(company: CompanyKey) {
  if (openGroups.value.has(company)) {
    openGroups.value.delete(company);
  } else {
    openGroups.value.add(company);
  }
}

// When user selects a model, auto-expand its group
watch(
  () => props.modelValue,
  (model) => {
    const prefix = model.id.split("/")[0] ?? "";
    const company = (COMPANY_ID_MAP[prefix] ?? prefix) as CompanyKey;
    openGroups.value.add(company);
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
        @click="toggleGroup(group.company as CompanyKey)"
      >
        <LogoColorMode
          :src="group.logo"
          :alt="`${group.label} logo`"
          class="size-4 shrink-0"
        />
        <div class="flex-1 min-w-0">
          <span
            class="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >{{ group.label }}</span
          >
          <span class="text-xs text-zinc-400 dark:text-zinc-500 ml-2">{{
            group.subtitle
          }}</span>
        </div>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 text-zinc-400 transition-transform shrink-0"
          :class="
            openGroups.has(group.company as CompanyKey) ? 'rotate-180' : ''
          "
        />
      </button>

      <!-- Models list -->
      <div
        v-if="openGroups.has(group.company as CompanyKey)"
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
          <!-- Selected indicator bar -->
          <span
            v-if="modelValue.id === model.id"
            class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-gradient-brand"
          />
          <!-- Radio dot -->
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

              <!-- Recommended badge -->
              <span
                v-if="model.recommended"
                class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
              >
                <UIcon name="i-lucide-star" class="size-2.5" />
                Recommended
              </span>

              <!-- Tier badge -->
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

            <div class="flex items-center gap-3 mt-1">
              <span
                class="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500"
              >
                <UIcon name="i-lucide-zap" class="size-3 text-amber-500" />
                {{ model.tokens_per_generation }} credits
              </span>
              <span class="text-[11px] text-zinc-400 dark:text-zinc-500">{{
                model.price_estimate
              }}</span>
              <span
                v-if="model.supports_image_input"
                class="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500"
              >
                <UIcon name="i-lucide-image" class="size-3" />
                Img input
              </span>
            </div>
          </div>

          <!-- Set as default button -->
          <button
            :title="
              props.defaultModelId === model.id
                ? 'Remove default'
                : 'Set as default'
            "
            class="shrink-0 p-1 rounded-md transition-colors"
            :class="
              props.defaultModelId === model.id
                ? 'text-primary'
                : 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-400 dark:hover:text-zinc-400'
            "
            @click.stop="
              emit(
                'set-default',
                props.defaultModelId === model.id ? null : model.id,
              )
            "
          >
            <UIcon
              :name="
                props.defaultModelId === model.id
                  ? 'i-lucide-bookmark-check'
                  : 'i-lucide-bookmark'
              "
              class="size-4"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
