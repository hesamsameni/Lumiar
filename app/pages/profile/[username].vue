<script setup lang="ts">
import { useGenerationService } from "~/services/generation.service";
import { useProfileService } from "~/services/profile.service";
import { useSocialService } from "~/services/social.service";
import { useCollectionService } from "~/services/collection.service";

const route = useRoute();
const { user: authUser } = useAuthState();
const toast = useToast();
const generationService = useGenerationService();
const profileService = useProfileService();
const socialService = useSocialService();
const collectionService = useCollectionService();

const username = computed(() => route.params.username as string);
const isOwnProfile = computed(() => profile.value?.id === authUser.value?.id);

const profile = ref<Record<string, unknown> | null>(null);
const generations = ref<Record<string, unknown>[]>([]);
const loading = ref(true);
const followersCount = ref(0);
const followingCount = ref(0);
const isFollowing = ref(false);
const isTogglingFollow = ref(false);
const activeTab = ref("generations");

const tabs = [
  { key: "generations", label: "Generations" },
  { key: "shared", label: "Shared" },
  { key: "collections", label: "Collections" },
];

interface CollectionItem {
  id: string;
  name: string;
  cover_image_url: string | null;
  is_public: boolean;
  collection_items: { generation_id: string }[];
}

const collections = ref<CollectionItem[]>([]);
const collectionsLoaded = ref(false);
const showNewCollectionModal = ref(false);
const newCollectionName = ref("");
const isCreatingCollection = ref(false);
const collectionFilter = ref<"all" | "in" | "out">("all");
const collectionsVersion = useState("collectionsVersion", () => 0);

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
      if (!map.has(item.generation_id)) map.set(item.generation_id, []);
      map.get(item.generation_id)!.push(col.name);
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
    items: typeof filteredGenerations.value;
  }> = [];
  const map = new Map<string, typeof filteredGenerations.value>();
  for (const gen of filteredGenerations.value) {
    const label = getGroupLabel((gen as any).created_at);
    if (!map.has(label)) {
      map.set(label, []);
      groups.push({ label, items: map.get(label)! });
    }
    map.get(label)!.push(gen);
  }
  return groups;
});

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
});

watch(
  [() => authUser.value?.id, () => profile.value?.id],
  () => {
    checkFollowing();
  },
  { immediate: true },
);
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
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-10"
      >
        <UAvatar
          :src="(profile.avatar_url as string | null) || undefined"
          :fallback="(profile.username as string)?.slice(0, 1).toUpperCase()"
          size="2xl"
          class="ring-4 ring-primary/20"
        />

        <div class="flex-1">
          <h1 class="text-2xl font-bold">{{ profile.username }}</h1>
          <p v-if="profile.full_name" class="text-zinc-500 dark:text-zinc-400">
            {{ profile.full_name }}
          </p>
          <p
            v-if="profile.bio"
            class="text-sm text-zinc-600 dark:text-zinc-300 mt-1 max-w-md"
          >
            {{ profile.bio }}
          </p>

          <div
            class="flex items-center gap-4 mt-3 text-sm text-zinc-500 dark:text-zinc-400"
          >
            <span
              ><strong class="text-zinc-900 dark:text-zinc-100">{{
                generations.length
              }}</strong>
              {{ isOwnProfile ? "creations" : "shared" }}</span
            >
            <span
              ><strong class="text-zinc-900 dark:text-zinc-100">{{
                followersCount
              }}</strong>
              followers</span
            >
            <span
              ><strong class="text-zinc-900 dark:text-zinc-100">{{
                followingCount
              }}</strong>
              following</span
            >
          </div>
        </div>

        <div class="flex gap-2">
          <template v-if="isOwnProfile">
            <UButton
              to="/profile/edit"
              variant="outline"
              color="neutral"
              size="sm"
              icon="i-lucide-pencil"
            >
              Edit profile
            </UButton>
          </template>
          <template v-else>
            <UButton
              :variant="isFollowing ? 'outline' : 'solid'"
              color="primary"
              size="sm"
              :loading="isTogglingFollow"
              @click="toggleFollow"
            >
              {{ isFollowing ? "Unfollow" : "Follow" }}
            </UButton>
          </template>
        </div>
      </div>

      <div
        v-if="isOwnProfile"
        class="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-6"
      >
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px"
          :class="
            activeTab === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span class="ml-1 text-xs text-zinc-400">
            {{
              tab.key === "shared"
                ? sharedGenerations.length
                : tab.key === "collections"
                  ? collections.length
                  : generations.length
            }}
          </span>
        </button>
      </div>

      <!-- Generations / Shared tab content -->
      <template v-if="activeTab !== 'collections'">
        <!-- Collection filter bar -->
        <div
          v-if="isOwnProfile && collectionsLoaded && collections.length"
          class="flex items-center gap-2 mb-5 flex-wrap"
        >
          <span
            class="text-xs text-zinc-500 dark:text-zinc-400 font-medium mr-1"
            >Filter:</span
          >
          <button
            v-for="f in [
              { value: 'all', label: 'All' },
              { value: 'out', label: 'Uncollected' },
              { value: 'in', label: 'In collections' },
            ]"
            :key="f.value"
            class="text-xs px-3 py-1 rounded-full border transition-all"
            :class="
              collectionFilter === f.value
                ? 'bg-primary border-primary text-white font-medium'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
            "
            @click="collectionFilter = f.value as 'all' | 'in' | 'out'"
          >
            {{ f.label }}
          </button>
        </div>

        <!-- Empty state -->
        <div v-if="!filteredGenerations.length" class="text-center py-20">
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
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            >
              <div
                v-for="gen in group.items"
                :key="(gen as any).id"
                class="relative"
              >
                <GenerationCard
                  :generation="gen as never"
                  :show-author="false"
                  :is-owner="isOwnProfile"
                  @deleted="handleDeleted"
                  @share-toggled="handleShareToggled"
                />
                <div
                  v-if="
                    isOwnProfile && generationCollections.has((gen as any).id)
                  "
                  class="absolute top-2 left-2 pointer-events-none max-w-[calc(100%-1rem)]"
                >
                  <div
                    class="bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1"
                  >
                    <UIcon
                      name="i-lucide-folder"
                      class="size-2.5 text-white flex-shrink-0"
                    />
                    <span class="text-white text-[10px] leading-tight truncate">
                      {{ generationCollectionLabel((gen as any).id) }}
                    </span>
                  </div>
                </div>
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
            class="group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all"
          >
            <div class="aspect-square bg-zinc-100 dark:bg-zinc-800 relative">
              <img
                v-if="col.cover_image_url"
                :src="col.cover_image_url"
                class="w-full h-full object-cover"
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
  </div>
</template>
