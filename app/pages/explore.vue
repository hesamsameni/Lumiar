<script setup lang="ts">
import { GENERATION_TAGS } from "~/utils/constants";
import { watchDebounced } from "@vueuse/core";
import { useGenerationService } from "~/services/generation.service";
import { useProfileService } from "~/services/profile.service";
import { useSocialService } from "~/services/social.service";

const generationService = useGenerationService();
const profileService = useProfileService();
const socialService = useSocialService();
const { user: authUser } = useAuthState();

const likedIds = ref<Set<string>>(new Set());

const searchQuery = ref("");
const selectedTag = ref<string | null>(null);
const generations = ref<Record<string, unknown>[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 24;
const hasMore = ref(true);

type GenerationRow = {
  id: string;
  user_id: string;
  output_image_url: string;
  prompt: string;
  model_name: string;
  created_at: string;
  metadata: { tags?: string[] } | null;
  likes?: { id: string }[];
};

type ProfileLite = {
  id: string;
  username: string;
  avatar_url: string | null;
};

async function fetchGenerations(reset = false) {
  if (reset) {
    page.value = 1;
    generations.value = [];
    hasMore.value = true;
  }
  if (!hasMore.value) return;
  loading.value = true;

  const { data, error } = await generationService.getExploreGenerations({
    page: page.value,
    pageSize,
    selectedTag: selectedTag.value,
    searchQuery: searchQuery.value,
  });
  loading.value = false;

  if (error) return;

  const rows = (data ?? []) as GenerationRow[];
  const userIds = [...new Set(rows.map((g) => g.user_id).filter(Boolean))];

  let profilesById: Record<string, ProfileLite> = {};
  if (userIds.length) {
    const { data: profiles } =
      await profileService.getProfilesLiteByIds(userIds);

    profilesById = Object.fromEntries(
      ((profiles ?? []) as ProfileLite[]).map((p) => [p.id, p]),
    );
  }

  const hydrated = rows.map((g) => {
    const profile = profilesById[g.user_id];

    return {
      ...g,
      profiles: profile
        ? {
            username: profile.username,
            avatar_url: profile.avatar_url,
          }
        : undefined,
    };
  });

  if (authUser.value?.id && rows.length) {
    const generationIds = rows.map((g) => g.id);
    const { data: likedRows } = await socialService.getBulkLikedByUser(
      authUser.value.id,
      generationIds,
    );
    const newLiked = new Set(likedIds.value);
    (likedRows ?? []).forEach((r) => newLiked.add(r.generation_id));
    likedIds.value = newLiked;
  }

  if (rows.length < pageSize) hasMore.value = false;
  generations.value = reset ? hydrated : [...generations.value, ...hydrated];
  page.value++;
}

watchDebounced([selectedTag, searchQuery], () => fetchGenerations(true), {
  debounce: 300,
});
onMounted(() => fetchGenerations(true));

const previewGenerationId = ref<string | null>(null);
const showPreviewModal = ref(false);

function openPreview(id: string) {
  previewGenerationId.value = id;
  showPreviewModal.value = true;
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-10">
    <div class="mb-8">
      <h1
        class="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-1"
      >
        Explore
      </h1>
      <p class="text-zinc-500 dark:text-zinc-400">
        Discover what the community is creating
      </p>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search prompts…"
        class="flex-1"
      />
    </div>

    <div class="flex flex-wrap gap-2 mb-6">
      <button
        class="text-xs px-3 py-1.5 rounded-full border transition-all"
        :class="
          selectedTag === null
            ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary font-medium ring-1 ring-primary/20'
            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
        "
        @click="selectedTag = null"
      >
        All
      </button>
      <button
        v-for="tag in GENERATION_TAGS"
        :key="tag"
        class="text-xs px-3 py-1.5 rounded-full border transition-all"
        :class="
          selectedTag === tag
            ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary font-medium ring-1 ring-primary/20'
            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
        "
        @click="selectedTag = selectedTag === tag ? null : tag"
      >
        {{ tag }}
      </button>
    </div>

    <div
      v-if="loading && !generations.length"
      class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3"
    >
      <div
        v-for="i in 15"
        :key="i"
        class="mb-3 break-inside-avoid"
      >
        <div
          class="relative overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800"
          :style="{ height: `${[200, 260, 220, 320, 240, 280][i % 6]}px` }"
        >
          <div
            class="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent"
          />
        </div>
      </div>
    </div>

    <div v-else-if="!generations.length" class="text-center py-20">
      <UIcon
        name="i-lucide-image-off"
        class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
      />
      <p class="text-zinc-500 dark:text-zinc-400">No generations found</p>
    </div>

    <div v-else>
      <div class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3">
        <div
          v-for="(gen, idx) in generations"
          :key="(gen as { id: string }).id"
          class="mb-3 break-inside-avoid animate-fade-up"
          :style="{ animationDelay: `${(idx % 12) * 40}ms` }"
        >
          <GenerationCard
            :generation="gen as never"
            :show-author="true"
            :masonry="true"
            :initial-is-liked="likedIds.has((gen as { id: string }).id)"
            @preview="openPreview"
          />
        </div>
      </div>

      <div v-if="hasMore" class="text-center mt-8">
        <UButton
          variant="outline"
          color="neutral"
          :loading="loading"
          @click="fetchGenerations()"
        >
          Load more
        </UButton>
      </div>
    </div>

    <GenerationDetailModal
      v-model:open="showPreviewModal"
      :generation-id="previewGenerationId"
    />
  </div>
</template>
