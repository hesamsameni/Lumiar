<script setup lang="ts">
import type { VideoModel } from "~/utils/videoModels";
import {
  groupVideoModels,
  inferVideoMaker,
  TIER_BADGE,
  TIER_LABEL,
} from "~/utils/modelCompanies";

const props = defineProps<{
  modelValue: VideoModel;
}>();

const emit = defineEmits<{
  "update:modelValue": [model: VideoModel];
}>();

const { models } = useVideoModels();

const groupedModels = computed(() => groupVideoModels(models.value));

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
    if (model) openGroups.value.add(inferVideoMaker(model));
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
          <span
            class="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >{{ group.label }}</span
          >
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
              <span
                v-if="model.supports_video_input"
                class="flex items-center gap-1 text-[11px] text-indigo-500 dark:text-indigo-400"
              >
                <UIcon name="i-lucide-film" class="size-3" />
                Video input
              </span>
              <span
                v-if="model.supports_audio_input"
                class="flex items-center gap-1 text-[11px] text-violet-500 dark:text-violet-400"
              >
                <UIcon name="i-lucide-music" class="size-3" />
                Audio input
              </span>
              <span
                v-if="model.supports_audio_generation"
                class="flex items-center gap-1 text-[11px] text-emerald-500 dark:text-emerald-400"
              >
                <UIcon name="i-lucide-volume-2" class="size-3" />
                Audio gen
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
