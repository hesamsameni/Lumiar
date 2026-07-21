<script setup lang="ts">
import { useGenerationService } from "~/services/generation.service";
import { useVideoGenerationService } from "~/services/videoGeneration.service";
import { useProfileService } from "~/services/profile.service";
import { useSocialService } from "~/services/social.service";
import { useCollectionService } from "~/services/collection.service";
import type { MediaItem, MediaType } from "~/types/media.types";

const route = useRoute();
const { user: authUser } = useAuthState();
const toast = useToast();
const generationService = useGenerationService();
const videoGenerationService = useVideoGenerationService();
const profileService = useProfileService();
const socialService = useSocialService();
const collectionService = useCollectionService();
const userVideos = ref<Record<string, unknown>[]>([]);

const username = computed(() => route.params.username as string);
const isOwnProfile = computed(() => profile.value?.id === authUser.value?.id);

const profile = ref<Record<string, unknown> | null>(null);
const generations = ref<Record<string, unknown>[]>([]);
const loading = ref(true);
const followersCount = ref(0);
const followingCount = ref(0);
const isFollowing = ref(false);
const isTogglingFollow = ref(false);
// A single "view" drives everything, so mobile shows one tidy filter row
// instead of separate tab / media / collection filter clusters.
type ProfileView =
  | "all"
  | "images"
  | "videos"
  | "shared"
  | "uncollected"
  | "collections";
const view = ref<ProfileView>("all");

const activeTab = computed(() =>
  view.value === "collections"
    ? "collections"
    : view.value === "shared"
      ? "shared"
      : "generations",
);

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
const collectionFilter = computed<"all" | "in" | "out">(() =>
  view.value === "uncollected" ? "out" : "all",
);
const mediaFilter = computed<"all" | MediaType>(() =>
  view.value === "images" ? "image" : view.value === "videos" ? "video" : "all",
);
const collectionsVersion = useState("collectionsVersion", () => 0);

// The single filter row. Collection-related chips are owner-only.
const viewChips = computed(() => {
  const chips: { value: ProfileView; label: string; icon: string }[] = [
    { value: "all", label: "All", icon: "i-lucide-layout-grid" },
    { value: "images", label: "Images", icon: "i-lucide-image" },
    { value: "videos", label: "Videos", icon: "i-lucide-video" },
  ];
  if (isOwnProfile.value) {
    chips.push({ value: "shared", label: "Shared", icon: "i-lucide-globe" });
    if (collections.value.length) {
      chips.push({
        value: "uncollected",
        label: "Uncollected",
        icon: "i-lucide-folder-minus",
      });
    }
    chips.push({ value: "collections", label: "Collections", icon: "i-lucide-folder" });
  }
  return chips;
});
const likedIds = ref<Set<string>>(new Set());

async function fetchProfile() {
  const { data } = await profileService.getProfileByUsername(username.value);
  profile.value = data;
}

async function fetchGenerations() {
  if (!profile.value) return;
  const isOwn = profile.value.id === authUser.value?.id;
  const { data } = await generationService.getGenerationsByUser(
    profile.value.id as string,
    !isOwn,
  );
  generations.value = data ?? [];

  if (authUser.value?.id && generations.value.length) {
    const generationIds = (generations.value as { id: string }[]).map(
      (g) => g.id,
    );
    const { data: likedRows } = await socialService.getBulkLikedByUser(
      authUser.value.id,
      generationIds,
    );
    likedIds.value = new Set((likedRows ?? []).map((r) => r.generation_id));
  }
}

async function fetchVideos() {
  if (!profile.value) return;
  try {
    const isOwn = profile.value.id === authUser.value?.id;
    const { data } = await videoGenerationService.getVideosByUser(
      profile.value.id as string,
      !isOwn,
    );
    userVideos.value = data ?? [];
  } catch (err) {
    // Never let a video-fetch failure block the rest of the profile.
    console.error("[profile] fetchVideos failed:", err);
    userVideos.value = [];
  }
}

async function fetchFollowCounts() {
  if (!profile.value) return;
  const [{ count: followers }, { count: following }] = await Promise.all([
    socialService.getFollowersCount(profile.value.id as string),
    socialService.getFollowingCount(profile.value.id as string),
  ]);
  followersCount.value = followers ?? 0;
  followingCount.value = following ?? 0;
}

async function checkFollowing() {
  if (!authUser.value?.id || !profile.value?.id || isOwnProfile.value) {
    isFollowing.value = false;
    return;
  }
  const { data } = await socialService.getFollowByUser(
    authUser.value.id,
    profile.value.id as string,
  );
  isFollowing.value = !!data;
}

async function toggleFollow() {
  if (!authUser.value?.id) {
    toast.add({ title: "Sign in to follow", color: "warning" });
    return;
  }
  if (!profile.value?.id || isOwnProfile.value) return;

  isTogglingFollow.value = true;
  try {
    if (isFollowing.value) {
      await socialService.unfollowUser(
        authUser.value.id,
        profile.value.id as string,
      );
      followersCount.value--;
    } else {
      await socialService.followUser(
        authUser.value.id,
        profile.value.id as string,
      );
      followersCount.value++;
    }
    isFollowing.value = !isFollowing.value;
  } catch {
    toast.add({ title: "Action failed", color: "error" });
  } finally {
    isTogglingFollow.value = false;
  }
}

function handleDeleted(id: string) {
  generations.value = generations.value.filter(
    (g) => (g as { id: string }).id !== id,
  );
  userVideos.value = userVideos.value.filter(
    (v) => (v as { id: string }).id !== id,
  );
}

function handleShareToggled(id: string, isShared: boolean) {
  const gen = generations.value.find((g) => (g as { id: string }).id === id);
  if (gen) (gen as Record<string, unknown>).is_shared = isShared;
}

const sharedGenerations = computed(() =>
  generations.value.filter((g) => (g as { is_shared: boolean }).is_shared),
);
const displayedGenerations = computed(() =>
  activeTab.value === "shared" ? sharedGenerations.value : generations.value,
);

const generationCollections = computed(() => {
  const map = new Map<string, string[]>();
  for (const col of collections.value) {
    for (const item of col.collection_items) {
      const mediaId =
        (item as { generation_id?: string | null }).generation_id ??
        (item as { video_generation_id?: string | null }).video_generation_id;
      if (!mediaId) continue;
      if (!map.has(mediaId)) map.set(mediaId, []);
      map.get(mediaId)!.push(col.name);
    }
  }
  return map;
});

function generationCollectionLabel(id: string): string {
  const names = generationCollections.value.get(id);
  if (!names?.length) return "";
  if (names.length === 1) return names[0]!;
  return `${names[0]} +${names.length - 1}`;
}

const filteredGenerations = computed(() => {
  const base = displayedGenerations.value;
  if (collectionFilter.value === "in") {
    return base.filter((g) => generationCollections.value.has((g as any).id));
  }
  if (collectionFilter.value === "out") {
    return base.filter((g) => !generationCollections.value.has((g as any).id));
  }
  return base;
});

// This user's completed videos, mapped into the mixed feed.
const profileVideos = computed<MediaItem[]>(() => {
  let list = userVideos.value;
  if (activeTab.value === "shared") {
    list = list.filter((v) => (v as { is_shared?: boolean }).is_shared);
  }
  return list.map((v) => ({
    ...(v as Record<string, unknown>),
    media_type: "video" as const,
    profiles: {
      username: profile.value?.username as string,
      avatar_url: (profile.value?.avatar_url as string | null) ?? null,
    },
  })) as MediaItem[];
});

// Media-aware feed used for rendering. Select mode stays images-only since bulk
// actions/collections don't apply to placeholder videos yet.
const mediaFeed = computed<MediaItem[]>(() => {
  const images = filteredGenerations.value.map((g) => ({
    ...(g as Record<string, unknown>),
    media_type: "image" as const,
  })) as MediaItem[];

  if (isSelectMode.value) return images;

  if (mediaFilter.value === "image") return images;
  if (mediaFilter.value === "video") return profileVideos.value;

  return [...images, ...profileVideos.value].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
});

function getGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isCurrentMonth =
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (!isCurrentMonth) {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const day = date.getDate();
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  if (day <= 7) return `First week of ${monthName}`;
  if (day <= 14) return `Second week of ${monthName}`;
  if (day <= 21) return `Third week of ${monthName}`;
  if (day <= 28) return `Fourth week of ${monthName}`;
  return `Fifth week of ${monthName}`;
}

const groupedGenerations = computed(() => {
  const groups: Array<{
    label: string;
    items: MediaItem[];
  }> = [];
  const map = new Map<string, MediaItem[]>();
  for (const gen of mediaFeed.value) {
    const label = getGroupLabel(gen.created_at);
    if (!map.has(label)) {
      map.set(label, []);
      groups.push({ label, items: map.get(label)! });
    }
    map.get(label)!.push(gen);
  }
  return groups;
});

/** CSS aspect-ratio for select-mode tiles (matches masonry cards). */
function mediaAspectStyle(item: MediaItem): { aspectRatio: string } {
  const ar = item.aspect_ratio;
  if (ar && ar !== "auto") {
    const [w, h] = ar.split(":").map(Number);
    if (w && h) return { aspectRatio: `${w} / ${h}` };
  }
  return {
    aspectRatio: item.media_type === "video" ? "16 / 9" : "1 / 1",
  };
}

const filterEmptyMessage = computed(() => {
  if (!isOwnProfile.value) return "No shared images yet";
  if (activeTab.value === "shared") return "No shared generations yet";
  if (generations.value.length === 0) return "No generations yet";
  if (collectionFilter.value === "in")
    return "None of your images are in a collection yet";
  if (collectionFilter.value === "out")
    return "All your images are organized into collections!";
  return "No generations yet";
});

async function fetchCollections() {
  if (!profile.value?.id || collectionsLoaded.value) return;
  const isOwn = profile.value.id === authUser.value?.id;
  if (!isOwn) {
    collectionsLoaded.value = true;
    return;
  }
  const { data } = await collectionService.getCollectionsByUser(
    profile.value.id as string,
    false,
  );
  collections.value = (data ?? []) as CollectionItem[];
  collectionsLoaded.value = true;
}

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

async function deleteCollection(id: string) {
  const { error } = await collectionService.deleteCollection(id);
  if (error) {
    toast.add({ title: "Failed to delete collection", color: "error" });
    return;
  }
  collections.value = collections.value.filter((c) => c.id !== id);
  toast.add({ title: "Collection deleted", color: "success" });
}

watch(activeTab, (tab) => {
  if (tab === "collections") fetchCollections();
});

watch(collectionsVersion, () => {
  collectionsLoaded.value = false;
  fetchCollections();
});

onMounted(async () => {
  await fetchProfile();
  await Promise.all([
    fetchGenerations(),
    fetchFollowCounts(),
    checkFollowing(),
    fetchCollections(),
  ]);
  loading.value = false;
  // Videos load independently so they can never block the main feed.
  fetchVideos();
});

watch(
  [() => authUser.value?.id, () => profile.value?.id],
  () => {
    checkFollowing();
  },
  { immediate: true },
);

const previewGenerationId = ref<string | null>(null);
const showPreviewModal = ref(false);
const previewVideoId = ref<string | null>(null);
const showVideoModal = ref(false);

function openPreview(id: string) {
  if (isSelectMode.value) {
    toggleSelect(id);
    return;
  }
  if (userVideos.value.some((v) => (v as { id: string }).id === id)) {
    previewVideoId.value = id;
    showVideoModal.value = true;
    return;
  }
  previewGenerationId.value = id;
  showPreviewModal.value = true;
}

// ─── Multi-select ─────────────────────────────────────────────────────────────
const isSelectMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());

function enterSelectMode() {
  isSelectMode.value = true;
  selectedIds.value = new Set();
}

function exitSelectMode() {
  isSelectMode.value = false;
  selectedIds.value = new Set();
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function selectAll() {
  selectedIds.value = new Set(
    filteredGenerations.value.map((g) => (g as any).id as string),
  );
}

const selectedCount = computed(() => selectedIds.value.size);

// Bulk delete
const isBulkDeleting = ref(false);
const showBulkDeleteModal = ref(false);
const { session } = useAuthState();

async function bulkDelete() {
  isBulkDeleting.value = true;
  const ids = [...selectedIds.value];
  try {
    await Promise.all(
      ids.map((id) =>
        $fetch(`/api/generations/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.value?.access_token ?? ""}`,
          },
        }),
      ),
    );
    generations.value = generations.value.filter(
      (g) => !ids.includes((g as any).id),
    );
    toast.add({
      title: `${ids.length} image${ids.length > 1 ? "s" : ""} deleted`,
      color: "success",
    });
  } catch {
    toast.add({ title: "Failed to delete some images", color: "error" });
  } finally {
    isBulkDeleting.value = false;
    showBulkDeleteModal.value = false;
    exitSelectMode();
  }
}

// Bulk add to collection
const showBulkCollectionPicker = ref(false);

const firstSelectedImageUrl = computed(() => {
  const firstId = [...selectedIds.value][0];
  if (!firstId) return undefined;
  const gen = filteredGenerations.value.find((g) => (g as any).id === firstId);
  return gen ? ((gen as any).output_image_url as string) : undefined;
});
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <template v-else-if="profile">
      <!-- Hero -->
      <div class="relative mb-10">
        <div
          class="flex flex-col sm:flex-row items-start sm:items-center gap-6"
        >
          <span
            class="rounded-full p-1 bg-conic-brand shadow-glow-brand flex-shrink-0"
          >
            <UAvatar
              :src="(profile.avatar_url as string | null) || undefined"
              :fallback="(profile.username as string)?.slice(0, 1).toUpperCase()"
              size="3xl"
              class="size-24 sm:size-32 text-4xl ring-4 ring-white dark:ring-zinc-950"
            />
          </span>

          <div class="flex-1 min-w-0">
            <h1
              class="font-display text-3xl sm:text-4xl font-bold tracking-tight"
            >
              {{ profile.username }}
            </h1>
            <p v-if="profile.full_name" class="text-zinc-500 dark:text-zinc-400">
              {{ profile.full_name }}
            </p>
            <p
              v-if="profile.bio"
              class="text-sm text-zinc-600 dark:text-zinc-300 mt-1 max-w-md"
            >
              {{ profile.bio }}
            </p>

            <div class="flex flex-wrap items-center gap-2 mt-4">
              <div
                class="flex items-baseline gap-1.5 rounded-full border border-zinc-200/70 dark:border-zinc-800/70 bg-white/60 dark:bg-zinc-900/50 backdrop-blur px-3 py-1"
              >
                <span class="font-display font-bold text-zinc-900 dark:text-white">{{
                  generations.length
                }}</span>
                <span class="text-xs text-zinc-500 dark:text-zinc-400">{{
                  isOwnProfile ? "creations" : "shared"
                }}</span>
              </div>
              <div
                class="flex items-baseline gap-1.5 rounded-full border border-zinc-200/70 dark:border-zinc-800/70 bg-white/60 dark:bg-zinc-900/50 backdrop-blur px-3 py-1"
              >
                <span class="font-display font-bold text-zinc-900 dark:text-white">{{
                  followersCount
                }}</span>
                <span class="text-xs text-zinc-500 dark:text-zinc-400"
                  >followers</span
                >
              </div>
              <div
                class="flex items-baseline gap-1.5 rounded-full border border-zinc-200/70 dark:border-zinc-800/70 bg-white/60 dark:bg-zinc-900/50 backdrop-blur px-3 py-1"
              >
                <span class="font-display font-bold text-zinc-900 dark:text-white">{{
                  followingCount
                }}</span>
                <span class="text-xs text-zinc-500 dark:text-zinc-400"
                  >following</span
                >
              </div>
            </div>
          </div>

          <div
            class="flex gap-2 absolute top-0 right-0 sm:static sm:top-auto sm:right-auto"
          >
            <template v-if="isOwnProfile">
              <UButton
                to="/profile/edit"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-pencil"
                :title="'Edit profile'"
              >
                <span class="hidden sm:inline">Edit profile</span>
              </UButton>
            </template>
            <template v-else>
              <UButton
                v-if="isFollowing"
                variant="outline"
                color="neutral"
                size="sm"
                :loading="isTogglingFollow"
                @click="toggleFollow"
              >
                Unfollow
              </UButton>
              <UButton
                v-else
                size="sm"
                class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
                :loading="isTogglingFollow"
                @click="toggleFollow"
              >
                Follow
              </UButton>
            </template>
          </div>
        </div>
      </div>

      <!-- Unified filter row (scrolls horizontally on mobile) + select control -->
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

        <!-- Select control (media grids only) -->
        <div
          v-if="isOwnProfile && activeTab !== 'collections'"
          class="flex items-center gap-1 flex-shrink-0"
        >
          <UButton
            v-if="!isSelectMode"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-check-square"
            @click="enterSelectMode"
          >
            <span class="hidden sm:inline">Select</span>
          </UButton>
          <template v-else>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              @click="selectAll"
            >
              <span class="hidden sm:inline">Select all</span>
              <UIcon name="i-lucide-check-check" class="size-4 sm:hidden" />
            </UButton>
            <UButton
              size="xs"
              variant="ghost"
              color="primary"
              @click="exitSelectMode"
            >
              Done
            </UButton>
          </template>
        </div>
      </div>

      <!-- Generations / Shared tab content -->
      <template v-if="activeTab !== 'collections'">
        <!-- Empty state -->
        <div v-if="!mediaFeed.length" class="text-center py-20">
          <UIcon
            name="i-lucide-image"
            class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
          />
          <p class="text-zinc-500 dark:text-zinc-400">
            {{ filterEmptyMessage }}
          </p>
          <UButton
            v-if="isOwnProfile && !generations.length"
            to="/"
            size="sm"
            class="mt-4"
          >
            Create your first image
          </UButton>
        </div>

        <!-- Date-grouped grid -->
        <template v-else>
          <div
            v-for="group in groupedGenerations"
            :key="group.label"
            class="mb-8 last:mb-0"
          >
            <p
              class="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3"
            >
              {{ group.label }}
            </p>
            <div
              class="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3"
            >
              <div
                v-for="gen in group.items"
                :key="(gen as any).id"
                class="relative group/tile mb-3 break-inside-avoid"
              >
                <!-- Selection overlay -->
                <template v-if="isSelectMode">
                  <button
                    class="block w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 focus:outline-none"
                    :style="mediaAspectStyle(gen)"
                    @click="toggleSelect((gen as any).id)"
                  >
                    <img
                      :src="
                        (gen as any).output_image_url ||
                        (gen as any).thumbnail_url
                      "
                      :alt="(gen as any).prompt"
                      class="w-full h-full object-cover transition-opacity duration-150"
                      :class="
                        selectedIds.has((gen as any).id)
                          ? 'opacity-70'
                          : 'opacity-100'
                      "
                    />
                  </button>
                  <!-- Checkbox indicator -->
                  <div class="absolute top-2 right-2 pointer-events-none">
                    <div
                      class="size-6 rounded-full border-2 flex items-center justify-center transition-all duration-150"
                      :class="
                        selectedIds.has((gen as any).id)
                          ? 'bg-primary border-primary'
                          : 'bg-black/30 border-white/80 backdrop-blur-sm'
                      "
                    >
                      <UIcon
                        v-if="selectedIds.has((gen as any).id)"
                        name="i-lucide-check"
                        class="size-3.5 text-white"
                      />
                    </div>
                  </div>
                </template>

                <template v-else>
                  <MediaCard
                    :item="gen"
                    :show-author="false"
                    :is-owner="isOwnProfile"
                    :masonry="true"
                    :initial-is-liked="likedIds.has(gen.id)"
                    @deleted="handleDeleted"
                    @share-toggled="handleShareToggled"
                    @removed-from-collection="handleDeleted"
                    @preview="openPreview"
                  />
                  <div
                    v-if="
                      isOwnProfile && generationCollections.has((gen as any).id)
                    "
                    class="absolute top-2 left-2 pointer-events-none max-w-[calc(100%-1rem)] transition-opacity duration-200 opacity-0 sm:opacity-100 sm:group-hover/tile:opacity-0"
                  >
                    <div
                      class="bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1"
                    >
                      <UIcon
                        name="i-lucide-folder"
                        class="size-2.5 text-white flex-shrink-0"
                      />
                      <span
                        class="text-white text-[10px] leading-tight truncate"
                      >
                        {{ generationCollectionLabel((gen as any).id) }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- Collections tab content -->
      <template v-else>
        <div v-if="isOwnProfile" class="flex justify-end mb-4">
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
            v-if="isOwnProfile"
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
            class="group rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 transition-all duration-300 hover:shadow-xl hover:shadow-zinc-300/50 dark:hover:shadow-black/50 hover:-translate-y-0.5"
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
                <UIcon
                  name="i-lucide-folder-plus"
                  class="size-5 text-primary"
                />
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
            <div class="px-4 py-5 space-y-3">
              <UInput
                v-model="newCollectionName"
                placeholder="e.g. Portraits, Nature, Abstract..."
                autofocus
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
    </template>

    <div v-else class="text-center py-20">
      <UIcon
        name="i-lucide-user-x"
        class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
      />
      <p class="text-zinc-500 dark:text-zinc-400">User not found</p>
    </div>

    <GenerationDetailModal
      v-model:open="showPreviewModal"
      :generation-id="previewGenerationId"
    />

    <VideoDetailModal
      v-model:open="showVideoModal"
      :video-id="previewVideoId"
      @deleted="handleDeleted"
    />

    <!-- Floating multi-select action bar -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-4"
      >
        <div
          v-if="isSelectMode"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-2xl px-4 py-3"
        >
          <span
            class="text-sm font-medium text-zinc-700 dark:text-zinc-200 mr-1"
          >
            {{ selectedCount }} selected
          </span>
          <UButton
            icon="i-lucide-folder-plus"
            size="sm"
            variant="soft"
            color="primary"
            :disabled="selectedCount === 0"
            @click="showBulkCollectionPicker = true"
          >
            Add to Collection
          </UButton>
          <UButton
            icon="i-lucide-trash-2"
            size="sm"
            variant="soft"
            color="error"
            :disabled="selectedCount === 0"
            @click="showBulkDeleteModal = true"
          >
            Delete
          </UButton>
          <UButton
            icon="i-lucide-x"
            size="sm"
            variant="ghost"
            color="neutral"
            @click="exitSelectMode"
          />
        </div>
      </Transition>
    </Teleport>

    <!-- Bulk delete confirm -->
    <ConfirmModal
      v-model:open="showBulkDeleteModal"
      title="Delete Images"
      :description="`Are you sure you want to delete ${selectedCount} image${selectedCount > 1 ? 's' : ''}? This cannot be undone.`"
      confirm-text="Delete"
      confirm-color="error"
      icon="i-lucide-trash-2"
      :loading="isBulkDeleting"
      @confirm="bulkDelete"
    />

    <!-- Bulk collection picker -->
    <CollectionPickerModal
      v-model:open="showBulkCollectionPicker"
      :generation-ids="[...selectedIds]"
      :cover-image-url="firstSelectedImageUrl"
      @update:open="
        (v) => {
          if (!v) {
            exitSelectMode();
            collectionsLoaded.value = false;
            fetchCollections();
          }
        }
      "
    />
  </div>
</template>
