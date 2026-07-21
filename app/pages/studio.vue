<script setup lang="ts">
import { useGenerationService } from "~/services/generation.service";
import { useVideoGenerationService } from "~/services/videoGeneration.service";
import { useCollectionService } from "~/services/collection.service";
import { useAuthService } from "~/services/auth.service";
import type { MediaItem, MediaType } from "~/types/media.types";

const { user: authUser, session } = useAuthState();
const { profile } = useProfile();
const { balance } = useTokens();
const toast = useToast();

const authService = useAuthService();
const generationService = useGenerationService();
const videoGenerationService = useVideoGenerationService();
const collectionService = useCollectionService();

// Resolve the real NuxtLink component so stat cards with a `to` actually
// navigate (a plain `:is="'NuxtLink'"` string renders an inert element).
const NuxtLinkComponent = resolveComponent("NuxtLink");

type DashboardView = "generations" | "uploads" | "collections";
const view = ref<DashboardView>("generations");

const loading = ref(true);
const generations = ref<Record<string, unknown>[]>([]);
const videos = ref<Record<string, unknown>[]>([]);
const likedIds = ref<Set<string>>(new Set());

// ─── Uploads (R2) ─────────────────────────────────────────────────────────
interface UploadAsset {
  key: string;
  url: string;
}
const uploads = ref<UploadAsset[]>([]);
const uploadsLoading = ref(false);
const uploadsLoaded = ref(false);

// ─── Collections ──────────────────────────────────────────────────────────
interface CollectionItem {
  id: string;
  name: string;
  cover_image_url: string | null;
  is_public: boolean;
  collection_items: {
    generation_id?: string | null;
    video_generation_id?: string | null;
  }[];
}
const collections = ref<CollectionItem[]>([]);
const collectionsLoaded = ref(false);
const showNewCollectionModal = ref(false);
const newCollectionName = ref("");
const isCreatingCollection = ref(false);

const mediaFilter = ref<"all" | MediaType>("all");

const viewChips = computed(() => [
  {
    value: "generations" as const,
    label: "Generations",
    icon: "i-lucide-layout-grid",
  },
  { value: "uploads" as const, label: "Uploads", icon: "i-lucide-upload" },
  {
    value: "collections" as const,
    label: "Collections",
    icon: "i-lucide-folder",
  },
]);

const stats = computed(() => [
  {
    label: "Credits",
    value: balance.value ?? "—",
    icon: "i-lucide-coins",
    to: "/credits",
  },
  {
    label: "Generations",
    value: generations.value.length,
    icon: "i-lucide-image",
  },
  { label: "Videos", value: videos.value.length, icon: "i-lucide-video" },
  {
    label: "Collections",
    value: collections.value.length,
    icon: "i-lucide-folder",
  },
]);

// ─── Fetching ───────────────────────────────────────────────────────────────
async function fetchGenerations() {
  if (!authUser.value?.id) return;
  const { data } = await generationService.getGenerationsByUser(
    authUser.value.id,
    false,
  );
  generations.value = data ?? [];
}

async function fetchVideos() {
  if (!authUser.value?.id) return;
  try {
    const { data } = await videoGenerationService.getVideosByUser(
      authUser.value.id,
      false,
    );
    videos.value = data ?? [];
  } catch (err) {
    console.error("[dashboard] fetchVideos failed:", err);
    videos.value = [];
  }
}

async function fetchCollections() {
  if (!authUser.value?.id) return;
  const { data } = await collectionService.getCollectionsByUser(
    authUser.value.id,
    false,
  );
  collections.value = (data ?? []) as CollectionItem[];
  collectionsLoaded.value = true;
}

async function fetchUploads() {
  if (uploadsLoaded.value) return;
  uploadsLoading.value = true;
  try {
    const { assets } = await $fetch<{ assets: UploadAsset[] }>(
      "/api/assets/uploads",
      {
        headers: {
          Authorization: `Bearer ${session.value?.access_token ?? ""}`,
        },
      },
    );
    uploads.value = assets ?? [];
    uploadsLoaded.value = true;
  } catch {
    toast.add({ title: "Failed to load uploads", color: "error" });
  } finally {
    uploadsLoading.value = false;
  }
}

// Lazy-load uploads the first time the tab is opened.
watch(view, (v) => {
  if (v === "uploads") fetchUploads();
});

// ─── Mixed media feed ─────────────────────────────────────────────────────
const videoFeed = computed<MediaItem[]>(() =>
  videos.value.map((v) => ({
    ...(v as Record<string, unknown>),
    media_type: "video" as const,
    profiles: {
      username: (profile.value?.username as string) ?? "",
      avatar_url: (profile.value?.avatar_url as string | null) ?? null,
    },
  })) as MediaItem[],
);

const mediaFeed = computed<MediaItem[]>(() => {
  const images = generations.value.map((g) => ({
    ...(g as Record<string, unknown>),
    media_type: "image" as const,
  })) as MediaItem[];

  if (mediaFilter.value === "image") return images;
  if (mediaFilter.value === "video") return videoFeed.value;

  return [...images, ...videoFeed.value].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
});

// ─── Card handlers ────────────────────────────────────────────────────────
function handleDeleted(id: string) {
  generations.value = generations.value.filter(
    (g) => (g as { id: string }).id !== id,
  );
  videos.value = videos.value.filter((v) => (v as { id: string }).id !== id);
}

function handleShareToggled(id: string, isShared: boolean) {
  const gen = generations.value.find((g) => (g as { id: string }).id === id);
  if (gen) (gen as Record<string, unknown>).is_shared = isShared;
}

// ─── Preview modals ─────────────────────────────────────────────────────────
const previewGenerationId = ref<string | null>(null);
const showPreviewModal = ref(false);
const previewVideoId = ref<string | null>(null);
const showVideoModal = ref(false);

function openPreview(id: string) {
  if (videos.value.some((v) => (v as { id: string }).id === id)) {
    previewVideoId.value = id;
    showVideoModal.value = true;
    return;
  }
  previewGenerationId.value = id;
  showPreviewModal.value = true;
}

// ─── Docked composer bridge ─────────────────────────────────────────────────
const composerRef = ref<{ addImage: (url: string) => void } | null>(null);

function addToComposer(url: string) {
  composerRef.value?.addImage(url);
  toast.add({ title: "Added to composer", color: "success" });
}

async function onVideoGenerated() {
  await fetchVideos();
  view.value = "generations";
  mediaFilter.value = "all";
}

// ─── New generation from the docked composer ─────────────────────────────────
function onGenerated(res: {
  generationId: string;
  imageUrl: string;
  prompt: string;
  modelName: string;
  aspectRatio: string;
}) {
  generations.value = [
    {
      id: res.generationId,
      output_image_url: res.imageUrl,
      prompt: res.prompt,
      model_name: res.modelName,
      aspect_ratio: res.aspectRatio,
      created_at: new Date().toISOString(),
      metadata: null,
      likes: [],
      is_shared: false,
    },
    ...generations.value,
  ];
  view.value = "generations";
}

// ─── Collection actions ───────────────────────────────────────────────────
async function createCollection() {
  if (!newCollectionName.value.trim() || !authUser.value?.id) return;
  isCreatingCollection.value = true;
  try {
    const { data, error } = await collectionService.createCollection({
      user_id: authUser.value.id,
      name: newCollectionName.value.trim(),
    });
    if (error) throw error;
    const col = data as CollectionItem;
    col.collection_items = [];
    collections.value.unshift(col);
    newCollectionName.value = "";
    showNewCollectionModal.value = false;
    toast.add({ title: `Collection "${col.name}" created`, color: "success" });
  } catch {
    toast.add({ title: "Failed to create collection", color: "error" });
  } finally {
    isCreatingCollection.value = false;
  }
}

async function loadAll() {
  if (!authUser.value?.id) return;
  loading.value = true;
  await Promise.all([fetchGenerations(), fetchCollections()]);
  loading.value = false;
  fetchVideos();
}

// Client-side auth guard (mirrors the pattern in profile/edit.vue): checking
// Supabase directly avoids the SSR race where `ready` is true but the session
// hasn't been reconstructed server-side, which would wrongly redirect.
onMounted(async () => {
  const currentUser = await authService.getCurrentUser();
  if (!currentUser?.id) {
    await navigateTo("/auth/login", { replace: true });
    return;
  }
  await loadAll();
});

useHead({ title: "Studio · Lumiar" });
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-10 pb-44">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="font-display text-3xl sm:text-4xl font-bold tracking-tight">
        Your <span class="text-gradient-brand">Studio</span>
      </h1>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
        Everything you've created, uploaded, and collected — in one place.
      </p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <component
        :is="stat.to ? NuxtLinkComponent : 'div'"
        v-for="stat in stats"
        :key="stat.label"
        :to="stat.to"
        class="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/60 dark:bg-zinc-900/50 backdrop-blur p-4 flex items-center gap-3 transition-colors"
        :class="stat.to ? 'hover:border-primary/40' : ''"
      >
        <span
          class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 flex-shrink-0"
        >
          <UIcon :name="stat.icon" class="size-[18px]" />
        </span>
        <div class="min-w-0">
          <p
            class="font-display text-xl font-bold text-zinc-900 dark:text-white leading-none"
          >
            {{ stat.value }}
          </p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
            {{ stat.label }}
          </p>
        </div>
      </component>
    </div>

    <!-- View switcher -->
    <div class="flex items-center gap-2 mb-6">
      <div class="flex-1 min-w-0 overflow-x-auto no-scrollbar">
        <div
          class="flex items-center gap-1 p-1 rounded-full bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 w-max"
        >
          <button
            v-for="chip in viewChips"
            :key="chip.value"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap"
            :class="
              view === chip.value
                ? 'bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            "
            @click="view = chip.value"
          >
            <UIcon
              :name="chip.icon"
              class="size-3.5"
              :class="view === chip.value ? 'text-primary' : ''"
            />
            <span :class="view === chip.value ? 'text-gradient-brand' : ''">{{
              chip.label
            }}</span>
          </button>
        </div>
      </div>

      <!-- Media type sub-filter (generations only) -->
      <div
        v-if="view === 'generations'"
        class="flex items-center gap-1 p-1 rounded-full bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 flex-shrink-0"
      >
        <button
          v-for="f in (['all', 'image', 'video'] as const)"
          :key="f"
          type="button"
          class="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all"
          :class="
            mediaFilter === f
              ? 'bg-white dark:bg-zinc-800 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          "
          @click="mediaFilter = f"
        >
          {{ f }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <template v-else>
      <!-- Generations -->
      <template v-if="view === 'generations'">
        <div v-if="!mediaFeed.length" class="text-center py-20">
          <UIcon
            name="i-lucide-image"
            class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
          />
          <p class="text-zinc-500 dark:text-zinc-400">
            Nothing yet — use the composer below to create your first image.
          </p>
        </div>
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 grid-flow-row-dense auto-rows-[168px] sm:auto-rows-[190px] lg:auto-rows-[210px]"
        >
          <div
            v-for="(gen, gidx) in mediaFeed"
            :key="(gen as any).id"
            class="relative group/tile"
            :class="mosaicSpan(gidx)"
          >
            <MediaCard
              :item="gen"
              :show-author="false"
              :is-owner="true"
              :fill="true"
              :initial-is-liked="likedIds.has((gen as any).id)"
              @deleted="handleDeleted"
              @share-toggled="handleShareToggled"
              @removed-from-collection="handleDeleted"
              @preview="openPreview"
            />
            <!-- Add-to-composer CTA (image generations only) -->
            <div
              v-if="(gen as any).media_type === 'image'"
              class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity duration-200"
            >
              <button
                type="button"
                class="pointer-events-auto flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 text-xs font-semibold backdrop-blur-md shadow-lg ring-1 ring-black/5 dark:ring-white/10 hover:!bg-gradient-brand hover:!text-white transition-all"
                @click.stop.prevent="
                  addToComposer((gen as any).output_image_url)
                "
              >
                <UIcon name="i-lucide-image-plus" class="size-3.5" />
                Add to composer
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Uploads -->
      <template v-else-if="view === 'uploads'">
        <div v-if="uploadsLoading" class="flex items-center justify-center py-24">
          <UIcon
            name="i-lucide-loader-circle"
            class="size-8 animate-spin text-primary"
          />
        </div>
        <div v-else-if="!uploads.length" class="text-center py-20">
          <UIcon
            name="i-lucide-upload"
            class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
          />
          <p class="text-zinc-500 dark:text-zinc-400">
            No uploaded assets yet. Attach images in the composer to see them
            here.
          </p>
        </div>
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        >
          <a
            v-for="asset in uploads"
            :key="asset.key"
            :href="asset.url"
            target="_blank"
            rel="noopener"
            class="group/tile relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800"
          >
            <img
              :src="asset.url"
              alt="Uploaded asset"
              loading="lazy"
              class="w-full h-full object-cover transition-transform duration-500 group-hover/tile:scale-[1.04]"
            />
            <!-- Add-to-composer CTA -->
            <div
              class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/0 group-hover/tile:bg-black/20 opacity-0 group-hover/tile:opacity-100 transition-all duration-200"
            >
              <button
                type="button"
                class="pointer-events-auto flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 text-xs font-semibold backdrop-blur-md shadow-lg ring-1 ring-black/5 dark:ring-white/10 hover:!bg-gradient-brand hover:!text-white transition-all"
                @click.stop.prevent="addToComposer(asset.url)"
              >
                <UIcon name="i-lucide-image-plus" class="size-3.5" />
                Add to composer
              </button>
            </div>
          </a>
        </div>
      </template>

      <!-- Collections -->
      <template v-else>
        <div class="flex justify-end mb-4">
          <UButton
            icon="i-lucide-folder-plus"
            size="sm"
            variant="outline"
            color="neutral"
            @click="showNewCollectionModal = true"
          >
            New collection
          </UButton>
        </div>

        <div v-if="!collections.length" class="text-center py-20">
          <UIcon
            name="i-lucide-folder"
            class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
          />
          <p class="text-zinc-500 dark:text-zinc-400">No collections yet</p>
          <UButton
            size="sm"
            class="mt-4"
            @click="showNewCollectionModal = true"
          >
            Create a collection
          </UButton>
        </div>

        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
        >
          <NuxtLink
            v-for="col in collections"
            :key="col.id"
            :to="`/collections/${col.id}`"
            class="group rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
          >
            <div class="aspect-square bg-zinc-100 dark:bg-zinc-800 relative">
              <img
                v-if="col.cover_image_url"
                :src="col.cover_image_url"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                alt=""
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center"
              >
                <UIcon
                  name="i-lucide-images"
                  class="size-10 text-zinc-300 dark:text-zinc-600"
                />
              </div>
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
              />
              <div class="absolute bottom-0 left-0 right-0 p-3">
                <p class="text-white font-semibold text-sm truncate">
                  {{ col.name }}
                </p>
                <p class="text-white/70 text-xs">
                  {{ col.collection_items.length }}
                  {{ col.collection_items.length === 1 ? "item" : "items" }}
                </p>
              </div>
            </div>
          </NuxtLink>
        </div>
      </template>
    </template>

    <!-- New collection modal -->
    <UModal v-model:open="showNewCollectionModal">
      <template #content>
        <div>
          <div
            class="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between"
          >
            <h3
              class="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2"
            >
              <UIcon name="i-lucide-folder-plus" class="size-5 text-primary" />
              New collection
            </h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="-my-1"
              @click="showNewCollectionModal = false"
            />
          </div>
          <div class="px-4 py-5">
            <UInput
              v-model="newCollectionName"
              placeholder="e.g. Portraits, Nature, Abstract..."
              autofocus
              class="w-full"
              @keyup.enter="createCollection"
            />
          </div>
          <div
            class="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2"
          >
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isCreatingCollection"
              @click="showNewCollectionModal = false"
            >
              Cancel
            </UButton>
            <UButton
              :loading="isCreatingCollection"
              :disabled="!newCollectionName.trim()"
              @click="createCollection"
            >
              Create
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <GenerationDetailModal
      v-model:open="showPreviewModal"
      :generation-id="previewGenerationId"
    />
    <VideoDetailModal
      v-model:open="showVideoModal"
      :video-id="previewVideoId"
      @deleted="handleDeleted"
    />

    <!-- Docked composer overlay -->
    <ClientOnly>
      <DashboardComposer
        ref="composerRef"
        @generated="onGenerated"
        @video-generated="onVideoGenerated"
      />
    </ClientOnly>
  </div>
</template>
