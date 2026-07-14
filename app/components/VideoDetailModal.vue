<script setup lang="ts">
import { useVideoGenerationService } from "~/services/videoGeneration.service";
import { useProfileService } from "~/services/profile.service";
import { downloadImageToDevice } from "~/utils/download";

const props = defineProps<{
  open: boolean;
  videoId: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  deleted: [id: string];
}>();

const { user: authUser, session } = useAuthState();
const videoService = useVideoGenerationService();
const profileService = useProfileService();
const toast = useToast();
const posthog = usePostHog();

const video = ref<Record<string, unknown> | null>(null);
const loading = ref(false);
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

async function fetchVideo() {
  if (!props.videoId) return;
  loading.value = true;
  video.value = null;
  const { data } = await videoService.getVideoById(props.videoId);
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
  }
  loading.value = false;
}

async function downloadVideo() {
  if (!video.value || !props.videoId) return;
  await downloadImageToDevice(
    video.value.output_video_url as string,
    `lumiar-${props.videoId}.mp4`,
  );
}

function remix() {
  if (!video.value) return;
  posthog?.capture("video_remixed", {
    generation_id: props.videoId,
    source: "detail_modal",
  });
  emit("update:open", false);
  navigateTo({ path: "/video", query: { prompt: video.value.prompt as string } });
}

async function toggleShare() {
  if (!props.videoId) return;
  isTogglingShare.value = true;
  try {
    const { error } = await videoService.setVideoShared(
      props.videoId,
      !isShared.value,
    );
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
  if (!props.videoId) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/video-generations/${props.videoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.value?.access_token ?? ""}` },
    });
    toast.add({ title: "Video deleted", color: "success" });
    emit("deleted", props.videoId);
    emit("update:open", false);
  } catch {
    toast.add({ title: "Failed to delete video", color: "error" });
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open && props.videoId) fetchVideo();
  },
);
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-4xl max-h-[90dvh] flex flex-col' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex flex-col max-h-[90dvh] overflow-hidden">
        <!-- Header -->
        <div
          class="relative flex items-center justify-between px-4 py-3 flex-shrink-0"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15"
            >
              <UIcon name="i-lucide-clapperboard" class="size-4" />
            </span>
            <h3 class="font-display font-bold text-sm tracking-tight">
              Video Details
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-external-link"
              size="xs"
              variant="ghost"
              color="neutral"
              :to="`/video/${videoId}`"
              @click="emit('update:open', false)"
            >
              Open page
            </UButton>
            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="emit('update:open', false)"
            />
          </div>
          <div
            class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />
        </div>

        <!-- Body -->
        <div class="overflow-y-auto flex-1 min-h-0">
          <div v-if="loading" class="flex items-center justify-center py-20">
            <UIcon
              name="i-lucide-loader-circle"
              class="size-8 animate-spin text-primary"
            />
          </div>

          <template v-else-if="video">
            <div class="flex flex-col lg:flex-row">
              <!-- Left: video + actions -->
              <div class="lg:flex-1 flex flex-col min-h-0">
                <div
                  class="flex-1 bg-black flex items-center justify-center p-2 sm:p-4"
                >
                  <video
                    :src="video.output_video_url as string"
                    controls
                    autoplay
                    muted
                    playsinline
                    class="max-w-full max-h-[45vh] lg:max-h-[70vh] w-auto rounded-2xl shadow-lg"
                  />
                </div>

                <div
                  class="flex gap-2 px-4 pt-3 pb-3 border-t border-zinc-100 dark:border-zinc-800 flex-shrink-0 flex-wrap"
                >
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
                  class="flex items-center gap-1 px-4 pb-3 flex-shrink-0 flex-wrap"
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
                    :generation-id="videoId!"
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

              <!-- Details sidebar -->
              <div
                class="lg:w-72 xl:w-80 shrink-0 p-4 space-y-4 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800"
              >
                <NuxtLink
                  v-if="video.profiles"
                  :to="`/profile/${(video.profiles as { username: string }).username}`"
                  class="flex items-center gap-2.5 group"
                  @click="emit('update:open', false)"
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

                <div>
                  <p
                    class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1"
                  >
                    Prompt
                  </p>
                  <p
                    class="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed"
                    :style="rtlStyle(video.prompt as string)"
                    :dir="hasRtlChars(video.prompt as string) ? 'rtl' : 'ltr'"
                  >
                    {{ video.prompt }}
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                  >
                    <UIcon name="i-lucide-clapperboard" class="size-3" />
                    {{ video.model_name }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                  >
                    <UIcon name="i-lucide-clock" class="size-3" />
                    {{ video.duration_seconds }}s
                  </span>
                  <span
                    v-if="video.resolution"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
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
          </template>

          <div v-else class="text-center py-20">
            <UIcon
              name="i-lucide-video-off"
              class="size-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2"
            />
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              Video not found
            </p>
          </div>
        </div>
      </div>
    </template>
  </UModal>

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
    v-if="videoId"
    v-model:open="showCollectionPicker"
    :generation-id="videoId"
    :generation-image-url="(video?.thumbnail_url as string) || undefined"
    media-type="video"
  />
</template>
