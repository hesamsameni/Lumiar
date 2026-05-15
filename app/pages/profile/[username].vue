<script setup lang="ts">
import { useGenerationService } from "~/services/generation.service";
import { useProfileService } from "~/services/profile.service";
import { useSocialService } from "~/services/social.service";

const route = useRoute();
const { user: authUser } = useAuthState();
const toast = useToast();
const generationService = useGenerationService();
const profileService = useProfileService();
const socialService = useSocialService();

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
];

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

onMounted(async () => {
  await fetchProfile();
  await Promise.all([
    fetchGenerations(),
    fetchFollowCounts(),
    checkFollowing(),
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
              creations</span
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
                : generations.length
            }}
          </span>
        </button>
      </div>

      <div v-if="!displayedGenerations.length" class="text-center py-20">
        <UIcon
          name="i-lucide-image"
          class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
        />
        <p class="text-zinc-500 dark:text-zinc-400">
          {{
            activeTab === "shared"
              ? "No shared generations yet"
              : "No generations yet"
          }}
        </p>
        <UButton v-if="isOwnProfile" to="/" size="sm" class="mt-4"
          >Create your first image</UButton
        >
      </div>

      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      >
        <GenerationCard
          v-for="gen in displayedGenerations"
          :key="(gen as { id: string }).id"
          :generation="gen as never"
          :show-author="false"
          :is-owner="isOwnProfile"
          @deleted="handleDeleted"
          @share-toggled="handleShareToggled"
        />
      </div>
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
