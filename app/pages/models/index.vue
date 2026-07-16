<script setup lang="ts">
import type { MediaType } from "~/types/media.types";
import {
  groupImageModels,
  groupVideoModels,
  modelExplorerPath,
  TIER_BADGE,
  TIER_LABEL,
  type CompanyGroup,
} from "~/utils/modelCompanies";
import type { AIModel } from "~/utils/models";
import type { VideoModel } from "~/utils/videoModels";

const config = useRuntimeConfig();
const siteUrl = (
  (config.public.siteUrl as string) || "https://www.lumiar.site"
).replace(/\/$/, "");
const canonical = `${siteUrl}/models`;

const title = "Models | Lumiar";
const description =
  "Browse every AI image and video model on Lumiar — compare capabilities, credits, and try them instantly.";

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogUrl: canonical,
  ogType: "website",
  twitterCard: "summary_large_image",
  twitterTitle: title,
  twitterDescription: description,
});

useHead({
  link: [{ rel: "canonical", href: canonical }],
});

const { fetchModels, models: imageModels, loading: imageLoading } = useModels();
const {
  fetchVideoModels,
  models: videoModels,
  loading: videoLoading,
} = useVideoModels();

await Promise.all([fetchModels(), fetchVideoModels()]);

const mediaFilter = ref<"all" | MediaType>("all");
const brokenLogos = ref<Set<string>>(new Set());

const imageGroups = computed(() => groupImageModels(imageModels.value));
const videoGroups = computed(() => groupVideoModels(videoModels.value));

const loading = computed(() => imageLoading.value || videoLoading.value);

type ExplorerSection = {
  type: MediaType;
  label: string;
  icon: string;
  groups: CompanyGroup<AIModel | VideoModel>[];
};

const sections = computed<ExplorerSection[]>(() => {
  const out: ExplorerSection[] = [];
  if (mediaFilter.value !== "video") {
    out.push({
      type: "image",
      label: "Image models",
      icon: "i-lucide-image",
      groups: imageGroups.value,
    });
  }
  if (mediaFilter.value !== "image") {
    out.push({
      type: "video",
      label: "Video models",
      icon: "i-lucide-video",
      groups: videoGroups.value,
    });
  }
  return out;
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-10">
    <div
      class="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
    >
      <div>
        <h1
          class="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-1"
        >
          Models
        </h1>
        <p class="text-zinc-500 dark:text-zinc-400">
          Browse every available image and video model, grouped by company
        </p>
      </div>
      <MediaTypeFilter v-model="mediaFilter" class="self-start" />
    </div>

    <div
      v-if="loading && !imageModels.length && !videoModels.length"
      class="space-y-8"
    >
      <div v-for="i in 3" :key="i" class="space-y-3">
        <div
          class="h-6 w-40 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse"
        />
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="j in 3"
            :key="j"
            class="h-36 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse"
          />
        </div>
      </div>
    </div>

    <div v-else class="space-y-14">
      <section v-for="section in sections" :key="section.type">
        <div class="flex items-center gap-2 mb-5">
          <UIcon :name="section.icon" class="size-5 text-primary" />
          <h2 class="font-display text-xl font-semibold tracking-tight">
            {{ section.label }}
          </h2>
          <span class="text-sm text-zinc-400">
            {{ section.groups.reduce((n, g) => n + g.models.length, 0) }}
          </span>
        </div>

        <div v-if="!section.groups.length" class="text-sm text-zinc-500 py-8">
          No {{ section.type }} models available.
        </div>

        <div v-else class="space-y-8">
          <div
            v-for="group in section.groups"
            :key="`${section.type}-${group.company}`"
          >
            <div class="flex items-center gap-2.5 mb-3">
              <LogoColorMode
                v-if="
                  group.logo &&
                  !brokenLogos.has(`${section.type}-${group.company}`)
                "
                :src="group.logo"
                :alt="`${group.label} logo`"
                class="size-5 shrink-0"
                @error="brokenLogos.add(`${section.type}-${group.company}`)"
              />
              <UIcon
                v-else
                :name="
                  section.type === 'video'
                    ? 'i-lucide-clapperboard'
                    : 'i-lucide-sparkles'
                "
                class="size-5 shrink-0 text-zinc-400"
              />
              <div class="min-w-0">
                <h3
                  class="text-base font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  {{ group.label }}
                </h3>
                <p
                  v-if="group.subtitle"
                  class="text-xs text-zinc-400 dark:text-zinc-500"
                >
                  {{ group.subtitle }}
                </p>
              </div>
            </div>

            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NuxtLink
                v-for="model in group.models"
                :key="model.id"
                :to="modelExplorerPath(section.type, model.id)"
                class="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 hover:border-primary/40 hover:bg-gradient-to-br hover:from-indigo-500/[0.04] hover:via-violet-500/[0.03] hover:to-fuchsia-500/[0.04] transition-all"
              >
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span
                      class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-gradient-brand transition-colors"
                    >
                      {{ model.name }}
                    </span>
                    <span
                      v-if="model.recommended"
                      class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
                    >
                      <UIcon name="i-lucide-star" class="size-2.5" />
                      Recommended
                    </span>
                    <span
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      :class="TIER_BADGE[model.tier]"
                    >
                      {{ TIER_LABEL[model.tier] }}
                    </span>
                  </div>
                  <UIcon
                    name="i-lucide-arrow-up-right"
                    class="size-4 shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-primary transition-colors"
                  />
                </div>

                <p
                  class="text-xs text-zinc-500 dark:text-zinc-400 leading-snug line-clamp-2 mb-3"
                >
                  {{ model.description }}
                </p>

                <div
                  class="flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500"
                >
                  <span class="flex items-center gap-1">
                    <UIcon name="i-lucide-zap" class="size-3 text-amber-500" />
                    {{ model.tokens_per_generation }} credits
                  </span>
                  <span
                    v-if="'duration_seconds' in model"
                    class="flex items-center gap-1"
                  >
                    <UIcon name="i-lucide-clock" class="size-3" />
                    {{ (model as VideoModel).duration_seconds }}s
                  </span>
                  <span
                    v-if="model.supports_image_input"
                    class="flex items-center gap-1"
                  >
                    <UIcon name="i-lucide-image" class="size-3" />
                    Img input
                  </span>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
