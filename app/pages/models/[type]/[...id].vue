<script setup lang="ts">
import { mosaicSpan } from "~/utils/mosaic";
import {
  IMAGE_COMPANY_META,
  VIDEO_COMPANY_META,
  inferImageMaker,
  inferVideoMaker,
  TIER_BADGE,
  TIER_LABEL,
} from "~/utils/modelCompanies";
import type { MediaItem } from "~/types/media.types";
import { useGenerationService } from "~/services/generation.service";
import { useVideoGenerationService } from "~/services/videoGeneration.service";
import { useProfileService } from "~/services/profile.service";
import { useSocialService } from "~/services/social.service";

const route = useRoute();
const config = useRuntimeConfig();
const siteUrl = (
  (config.public.siteUrl as string) || "https://www.lumiar.site"
).replace(/\/$/, "");

const typeParam = computed(() => String(route.params.type ?? ""));
const modelId = computed(() => {
  const id = route.params.id;
  return Array.isArray(id) ? id.join("/") : String(id ?? "");
});

const mediaType = computed(() => {
  if (typeParam.value === "image" || typeParam.value === "video") {
    return typeParam.value;
  }
  return null;
});

if (!mediaType.value || !modelId.value) {
  throw createError({ statusCode: 404, statusMessage: "Model not found" });
}

const { fetchModels, getModelById: getImageModel } = useModels();
const { fetchVideoModels, getModelById: getVideoModel } = useVideoModels();

await Promise.all([fetchModels(), fetchVideoModels()]);

const imageModel = computed(() =>
  mediaType.value === "image" ? getImageModel(modelId.value) : undefined,
);
const videoModel = computed(() =>
  mediaType.value === "video" ? getVideoModel(modelId.value) : undefined,
);
const model = computed(() => imageModel.value ?? videoModel.value);

if (!model.value) {
  throw createError({ statusCode: 404, statusMessage: "Model not found" });
}

watch([mediaType, modelId, model], ([type, id, m]) => {
  if (!type || !id || !m) {
    showError(
      createError({ statusCode: 404, statusMessage: "Model not found" }),
    );
  }
});

const companyKey = computed(() => {
  if (mediaType.value === "video" && videoModel.value) {
    return inferVideoMaker(videoModel.value);
  }
  if (imageModel.value) return inferImageMaker(imageModel.value);
  return "other";
});
const companyMeta = computed(() => {
  const key = companyKey.value;
  return mediaType.value === "video"
    ? (VIDEO_COMPANY_META[key] ?? null)
    : (IMAGE_COMPANY_META[key] ?? null);
});

const tryHref = computed(() =>
  mediaType.value === "video"
    ? { path: "/video", query: { model: modelId.value } }
    : { path: "/", query: { model: modelId.value } },
);

const title = computed(() => `${model.value!.name} | Models | Lumiar`);
const description = computed(
  () =>
    model.value!.description ||
    `Explore ${model.value!.name} on Lumiar — specs, credits, and community examples.`,
);
const canonical = computed(
  () => `${siteUrl}/models/${mediaType.value}/${modelId.value}`,
);

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

// --- Specs (hide internal provider) -----------------------------------------

type SpecRow = { label: string; value: string };

const specs = computed<SpecRow[]>(() => {
  const m = model.value!;
  const rows: SpecRow[] = [
    { label: "Tier", value: TIER_LABEL[m.tier] ?? m.tier },
    {
      label: "Credits",
      value: `${m.tokens_per_generation} per generation`,
    },
    { label: "Price estimate", value: m.price_estimate },
  ];

  if (imageModel.value) {
    const im = imageModel.value;
    rows.push(
      {
        label: "Image input",
        value: im.supports_image_input
          ? `Yes (up to ${im.max_image_inputs})`
          : "No",
      },
      {
        label: "Max resolution",
        value: im.max_resolution || "—",
      },
    );
    if (im.quality_options?.length) {
      rows.push({
        label: "Quality options",
        value: im.quality_options.map((o) => o.label).join(", "),
      });
      if (im.default_quality) {
        rows.push({ label: "Default quality", value: im.default_quality });
      }
    }
  }

  if (videoModel.value) {
    const vm = videoModel.value;
    rows.push(
      {
        label: "Default duration",
        value: `${vm.duration_seconds}s`,
      },
      {
        label: "Supported durations",
        value: (vm.supported_durations?.length
          ? vm.supported_durations
          : [vm.duration_seconds]
        )
          .map((d) => `${d}s`)
          .join(", "),
      },
      { label: "Resolution", value: vm.resolution },
      {
        label: "Aspect ratios",
        value: (vm.supported_aspect_ratios ?? []).join(", ") || "—",
      },
      {
        label: "Image input",
        value: vm.supports_image_input ? "Yes" : "No",
      },
      {
        label: "Last frame",
        value: vm.supports_last_frame ? "Yes" : "No",
      },
    );
    if (vm.resolution_options?.length) {
      rows.push({
        label: "Resolution options",
        value: vm.resolution_options.map((o) => o.label).join(", "),
      });
      if (vm.default_resolution) {
        rows.push({
          label: "Default resolution",
          value: vm.default_resolution,
        });
      }
    }
  }

  if (m.recommended) {
    rows.push({ label: "Recommended", value: "Yes" });
  }

  rows.push({ label: "Model ID", value: m.id });
  return rows;
});

// --- Community showcase -----------------------------------------------------

const generationService = useGenerationService();
const videoGenerationService = useVideoGenerationService();
const profileService = useProfileService();
const socialService = useSocialService();
const { user: authUser } = useAuthState();

const items = ref<MediaItem[]>([]);
const likedIds = ref<Set<string>>(new Set());
const loading = ref(false);
const page = ref(1);
const pageSize = 24;
const hasMore = ref(true);
const initialLoaded = ref(false);
const logoBroken = ref(false);

type ProfileLite = {
  id: string;
  username: string;
  avatar_url: string | null;
};

async function hydrateProfiles(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, ProfileLite>;
  const { data: profiles } = await profileService.getProfilesLiteByIds(userIds);
  return Object.fromEntries(
    ((profiles ?? []) as ProfileLite[]).map((p) => [p.id, p]),
  );
}

async function fetchShowcase(reset = false) {
  if (reset) {
    page.value = 1;
    items.value = [];
    hasMore.value = true;
  }
  if (!hasMore.value) return;

  loading.value = true;
  try {
    if (mediaType.value === "image") {
      const { data, error } = await generationService.getExploreGenerations({
        page: page.value,
        pageSize,
        selectedTag: null,
        searchQuery: "",
        modelId: modelId.value,
      });
      if (error) return;

      const rows = (data ?? []) as {
        id: string;
        user_id: string;
        output_image_url: string;
        prompt: string;
        model_name: string;
        created_at: string;
        metadata: { tags?: string[] } | null;
        likes?: { id: string }[];
        aspect_ratio?: string;
        quality?: string | null;
      }[];

      const profilesById = await hydrateProfiles([
        ...new Set(rows.map((g) => g.user_id).filter(Boolean)),
      ]);

      if (authUser.value?.id && rows.length) {
        const { data: likedRows } = await socialService.getBulkLikedByUser(
          authUser.value.id,
          rows.map((g) => g.id),
        );
        const next = new Set(likedIds.value);
        (likedRows ?? []).forEach((r) => next.add(r.generation_id));
        likedIds.value = next;
      }

      const hydrated: MediaItem[] = rows.map((g) => {
        const profile = profilesById[g.user_id];
        return {
          ...g,
          media_type: "image" as const,
          profiles: profile
            ? { username: profile.username, avatar_url: profile.avatar_url }
            : undefined,
        };
      });

      if (rows.length < pageSize) hasMore.value = false;
      items.value = reset ? hydrated : [...items.value, ...hydrated];
      page.value++;
    } else {
      const { data, error } = await videoGenerationService.getExploreVideos({
        page: page.value,
        pageSize,
        selectedTag: null,
        searchQuery: "",
        modelId: modelId.value,
      });
      if (error) return;

      const rows = (data ?? []) as {
        id: string;
        user_id: string;
        output_video_url: string | null;
        thumbnail_url: string | null;
        prompt: string;
        model_name: string;
        created_at: string;
        metadata: { tags?: string[] } | null;
        aspect_ratio?: string;
        duration_seconds: number;
        resolution?: string;
      }[];

      const profilesById = await hydrateProfiles([
        ...new Set(rows.map((v) => v.user_id).filter(Boolean)),
      ]);

      const hydrated: MediaItem[] = rows.map((v) => {
        const profile = profilesById[v.user_id];
        return {
          ...v,
          media_type: "video" as const,
          profiles: profile
            ? { username: profile.username, avatar_url: profile.avatar_url }
            : undefined,
        };
      });

      if (rows.length < pageSize) hasMore.value = false;
      items.value = reset ? hydrated : [...items.value, ...hydrated];
      page.value++;
    }
  } finally {
    loading.value = false;
    initialLoaded.value = true;
  }
}

watch(
  modelId,
  () => {
    initialLoaded.value = false;
    logoBroken.value = false;
    likedIds.value = new Set();
    fetchShowcase(true);
  },
  { immediate: true },
);

const previewGenerationId = ref<string | null>(null);
const showPreviewModal = ref(false);
const previewVideoId = ref<string | null>(null);
const showVideoModal = ref(false);

function openPreview(id: string) {
  if (mediaType.value === "video") {
    previewVideoId.value = id;
    showVideoModal.value = true;
    return;
  }
  previewGenerationId.value = id;
  showPreviewModal.value = true;
}

function handleVideoDeleted(id: string) {
  items.value = items.value.filter((v) => v.id !== id);
}

const showShowcase = computed(
  () => !initialLoaded.value || items.value.length > 0,
);
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-10">
    <nav class="mb-6">
      <NuxtLink
        to="/models"
        class="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-primary transition-colors"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        Models
      </NuxtLink>
    </nav>

    <div
      class="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-white via-zinc-50 to-indigo-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/30 p-6 sm:p-8 mb-10"
    >
      <div
        class="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/10 blur-3xl"
      />

      <div class="relative flex flex-col lg:flex-row lg:items-start gap-6">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-3 flex-wrap">
            <span
              class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-300"
            >
              <UIcon
                :name="
                  mediaType === 'video' ? 'i-lucide-video' : 'i-lucide-image'
                "
                class="size-3.5"
              />
              {{ mediaType === "video" ? "Video model" : "Image model" }}
            </span>
            <span
              v-if="companyMeta"
              class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-300"
            >
              <LogoColorMode
                v-if="companyMeta.logo && !logoBroken"
                :src="companyMeta.logo"
                :alt="companyMeta.label"
                class="size-3.5"
                @error="logoBroken = true"
              />
              {{ companyMeta.label }}
            </span>
            <span
              v-if="model!.recommended"
              class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
            >
              <UIcon name="i-lucide-star" class="size-2.5" />
              Recommended
            </span>
            <span
              class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              :class="TIER_BADGE[model!.tier]"
            >
              {{ TIER_LABEL[model!.tier] }}
            </span>
          </div>

          <h1
            class="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3"
          >
            {{ model!.name }}
          </h1>
          <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
            {{ model!.description }}
          </p>
        </div>

        <div class="shrink-0">
          <UButton
            :to="tryHref"
            size="lg"
            icon="i-lucide-sparkles"
            class="bg-gradient-brand text-white shadow-glow-brand"
          >
            Try it now
          </UButton>
        </div>
      </div>
    </div>

    <!-- Specs -->
    <section class="mb-12">
      <h2 class="font-display text-xl font-semibold tracking-tight mb-4">
        Specs
      </h2>
      <dl class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="row in specs"
          :key="row.label"
          class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-4 py-3"
        >
          <dt class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
            {{ row.label }}
          </dt>
          <dd class="text-sm text-zinc-800 dark:text-zinc-200 break-words">
            {{ row.value }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- Community showcase -->
    <section v-if="showShowcase">
      <div class="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 class="font-display text-xl font-semibold tracking-tight mb-1">
            Community showcase
          </h2>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Shared creations made with {{ model!.name }}
          </p>
        </div>
      </div>

      <div
        v-if="loading && !items.length"
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 grid-flow-row-dense auto-rows-[168px] sm:auto-rows-[190px] lg:auto-rows-[210px]"
      >
        <div
          v-for="i in 10"
          :key="i"
          class="rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse"
          :class="mosaicSpan(i)"
        />
      </div>

      <div v-else-if="items.length">
        <div
          class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 grid-flow-row-dense auto-rows-[168px] sm:auto-rows-[190px] lg:auto-rows-[210px]"
        >
          <MediaCard
            v-for="(item, idx) in items"
            :key="item.id"
            :item="item"
            :show-author="true"
            :fill="true"
            :initial-is-liked="likedIds.has(item.id)"
            class="animate-fade-up"
            :class="mosaicSpan(idx)"
            :style="{ animationDelay: `${(idx % 12) * 40}ms` }"
            @preview="openPreview"
          />
        </div>

        <div v-if="hasMore" class="text-center mt-8">
          <UButton
            variant="outline"
            color="neutral"
            :loading="loading"
            @click="fetchShowcase()"
          >
            Load more
          </UButton>
        </div>
      </div>
    </section>

    <GenerationDetailModal
      v-model:open="showPreviewModal"
      :generation-id="previewGenerationId"
    />

    <VideoDetailModal
      v-model:open="showVideoModal"
      :video-id="previewVideoId"
      @deleted="handleVideoDeleted"
    />
  </div>
</template>
