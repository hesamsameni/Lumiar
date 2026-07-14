<script setup lang="ts">
import { useVideoGenerationService } from "~/services/videoGeneration.service";
import { useProfileService } from "~/services/profile.service";
import { downloadImageToDevice } from "~/utils/download";

const route = useRoute();
const router = useRouter();
const { user: authUser, session } = useAuthState();
const toast = useToast();
const posthog = usePostHog();
const videoService = useVideoGenerationService();
const profileService = useProfileService();

const id = computed(() => route.params.id as string);
const video = ref<Record<string, unknown> | null>(null);
const loading = ref(true);
const isShared = ref(false);
const isTogglingShare = ref(false);
const isDeleting = ref(false);
const showDeleteModal = ref(false);
const showUnshareModal = ref(false);
const showCollectionPicker = ref(false);

function handleShareClick() {
  if (isShared.value) showUnshareModal.value = true;
  else toggleShare();
}

const isOwner = computed(
  () =>
    !!authUser.value?.id &&
    authUser.value.id === (video.value?.user_id as string | undefined),
);

const tags = computed(
  () => (video.value?.metadata as { tags?: string[] })?.tags ?? [],
);

useSeoMeta({
  title: () =>
    video.value ? `${video.value.prompt as string} — Lumiar` : "Video — Lumiar",
  ogTitle: () =>
    video.value ? `${video.value.prompt as string} — Lumiar` : "Video — Lumiar",
  ogDescription: () => "AI-generated video on Lumiar",
});

async function fetchVideo() {
  const { data } = await videoService.getVideoById(id.value);
  if (data) {
    const row = data as Record<string, unknown> & { user_id: string };
    const { data: profiles } = await profileService.getProfilesLiteByIds([
      row.user_id,
    ]);
    const author = (profiles ?? [])[0] as
      | { username: string; avatar_url: string | null }
      | undefined;
    video.value = {
      ...row,
      profiles: author
        ? { username: author.username, avatar_url: author.avatar_url }
        : undefined,
    };
    isShared.value = (row.is_shared as boolean) ?? false;
  } else {
    video.value = null;
  }
  loading.value = false;
}

async function downloadVideo() {
  if (!video.value) return;
  await downloadImageToDevice(
    video.value.output_video_url as string,
    `lumiar-${id.value}.mp4`,
  );
}

function remix() {
  if (!video.value) return;
  posthog?.capture("video_remixed", {
    generation_id: id.value,
    source: "video_page",
  });
  router.push({ path: "/video", query: { prompt: video.value.prompt as string } });
}

async function toggleShare() {
  isTogglingShare.value = true;
  try {
    const { error } = await videoService.setVideoShared(id.value, !isShared.value);
    if (error) throw error;
    isShared.value = !isShared.value;
    toast.add({
      title: isShared.value ? "Added to Explore" : "Removed from Explore",
      color: "success",
    });
  } catch {
    toast.add({ title: "Failed to update sharing", color: "error" });
  } finally {
    isTogglingShare.value = false;
    showUnshareModal.value = false;
  }
}

async function deleteVideo() {
  isDeleting.value = true;
  try {
    await $fetch(`/api/video-generations/${id.value}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.value?.access_token ?? ""}` },
    });
    toast.add({ title: "Video deleted", color: "success" });
    router.back();
  } catch {
    toast.add({ title: "Failed to delete video", color: "error" });
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

onMounted(fetchVideo);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <UButton
      icon="i-lucide-arrow-left"
      variant="ghost"
      color="neutral"
      size="sm"
      class="mb-6 rounded-full"
      @click="router.back()"
    >
      Back
    </UButton>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <template v-else-if="video">
      <div class="grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          <div
            class="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black"
          >
            <video
              :src="video.output_video_url as string"
              :poster="(video.thumbnail_url as string) || undefined"
              controls
              autoplay
              muted
              playsinline
              class="w-full max-h-[70vh]"
            />
          </div>

          <div class="flex gap-2 mt-4 flex-wrap">
            <UButton
              icon="i-lucide-download"
              size="sm"
              class="flex-1 !bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
              @click="downloadVideo"
            >
              Download
            </UButton>
            <UButton
              icon="i-lucide-shuffle"
              variant="outline"
              color="neutral"
              size="sm"
              class="flex-1"
              title="Start a new video from this prompt"
              @click="remix"
            >
              Remix
            </UButton>
          </div>

          <div
            v-if="isOwner"
            class="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800"
          >
            <UButton
              :icon="isShared ? 'i-lucide-eye-off' : 'i-lucide-share-2'"
              size="xs"
              :variant="isShared ? 'soft' : 'ghost'"
              color="primary"
              :loading="isTogglingShare"
              @click="handleShareClick"
            >
              <span class="hidden sm:inline">{{
                isShared ? "Unshare" : "Share to Explore"
              }}</span>
            </UButton>
            <UButton
              icon="i-lucide-folder-plus"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="showCollectionPicker = true"
            >
              <span class="hidden sm:inline">Collection</span>
            </UButton>
            <SocialShareMenu
              :generation-id="id"
              :image-url="video.output_video_url as string"
              :prompt="video.prompt as string"
              :is-shared="isShared"
              media-type="video"
              size="xs"
              @shared-to-explore="isShared = true"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="error"
              :loading="isDeleting"
              class="ml-auto"
              @click="showDeleteModal = true"
            >
              <span class="hidden sm:inline">Delete</span>
            </UButton>
          </div>
        </div>

        <div class="space-y-5">
          <div
            class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
          >
            <NuxtLink
              v-if="video.profiles"
              :to="`/profile/${(video.profiles as { username: string }).username}`"
              class="flex items-center gap-2.5 mb-4 group"
            >
              <span class="rounded-full p-px bg-conic-brand flex-shrink-0">
                <UAvatar
                  :src="
                    (video.profiles as { avatar_url?: string }).avatar_url ||
                    undefined
                  "
                  :fallback="
                    (video.profiles as { username: string }).username
                      ?.slice(0, 1)
                      .toUpperCase()
                  "
                  size="sm"
                  class="ring-2 ring-white dark:ring-zinc-900"
                />
              </span>
              <span
                class="text-sm font-semibold group-hover:text-primary transition-colors"
              >
                {{ (video.profiles as { username: string }).username }}
              </span>
            </NuxtLink>

            <div class="space-y-3 text-sm">
              <div>
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1"
                >
                  Prompt
                </p>
                <p
                  class="text-zinc-700 dark:text-zinc-300 leading-relaxed"
                  :style="rtlStyle(video.prompt as string)"
                  :dir="hasRtlChars(video.prompt as string) ? 'rtl' : 'ltr'"
                >
                  {{ video.prompt }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  <UIcon name="i-lucide-clapperboard" class="size-3" />
                  {{ video.model_name }}
                </span>
                <span
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  <UIcon name="i-lucide-clock" class="size-3" />
                  {{ video.duration_seconds }}s
                </span>
                <span
                  v-if="video.resolution"
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  <UIcon name="i-lucide-monitor" class="size-3" />
                  {{ video.resolution }}
                </span>
              </div>

              <div v-if="tags.length">
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1"
                >
                  Tags
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in tags"
                    :key="tag"
                    class="text-xs px-2.5 py-0.5 rounded-full border border-primary/20 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary font-medium"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="text-center py-20">
      <UIcon
        name="i-lucide-video-off"
        class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
      />
      <p class="text-zinc-500 dark:text-zinc-400">Video not found</p>
    </div>

    <ConfirmModal
      v-model:open="showDeleteModal"
      title="Delete Video"
      description="Are you sure you want to delete this video? This action cannot be undone."
      confirm-text="Delete"
      confirm-color="error"
      icon="i-lucide-trash-2"
      :loading="isDeleting"
      @confirm="deleteVideo"
    />

    <ConfirmModal
      v-model:open="showUnshareModal"
      title="Unshare Video"
      description="Are you sure you want to remove this video from the Explore feed? It will no longer be visible to other users."
      confirm-text="Unshare"
      confirm-color="primary"
      icon="i-lucide-eye-off"
      :loading="isTogglingShare"
      @confirm="toggleShare"
    />

    <CollectionPickerModal
      v-model:open="showCollectionPicker"
      :generation-id="id"
      :generation-image-url="(video?.thumbnail_url as string) || undefined"
      media-type="video"
    />
  </div>
</template>
