<script setup lang="ts">
import type { AIModel } from "~/utils/models";
import {
  groupImageModels,
  IMAGE_COMPANY_ORDER,
  inferImageMaker,
  TIER_BADGE,
  TIER_LABEL,
} from "~/utils/modelCompanies";

const props = defineProps<{
  modelValue: AIModel;
  defaultModelId?: string | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [model: AIModel];
  "set-default": [modelId: string | null];
}>();

const { models } = useModels();

const groupedModels = computed(() => groupImageModels(models.value));

// First group open by default, rest collapsed
const openGroups = ref<Set<string>>(
  new Set<string>([IMAGE_COMPANY_ORDER[0]!]),
);

function toggleGroup(company: string) {
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
    openGroups.value.add(inferImageMaker(model));
  },
  { immediate: true },
);

const tierBadge = TIER_BADGE;
const tierLabel = TIER_LABEL;
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
          v-if="group.logo"
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
