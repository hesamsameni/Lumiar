<script setup lang="ts">
import type { VideoGeneration } from "~/types/media.types";
import { useVideoGenerationService } from "~/services/videoGeneration.service";
import { useCollectionService } from "~/services/collection.service";

const props = defineProps<{
  generation: VideoGeneration;
  showAuthor?: boolean;
  isOwner?: boolean;
  masonry?: boolean;
  initialIsLiked?: boolean;
  collectionId?: string;
  fill?: boolean;
}>();

const emit = defineEmits<{
  deleted: [id: string];
  removedFromCollection: [id: string];
  preview: [id: string];
}>();

const toast = useToast();
const posthog = usePostHog();
const { session } = useAuthState();
const videoService = useVideoGenerationService();
const collectionService = useCollectionService();

const isShared = ref(props.generation.is_shared ?? false);
const isDeleting = ref(false);
const showDeleteModal = ref(false);
const showCollectionPicker = ref(false);
const isRemovingFromCollection = ref(false);
const showUnshareModal = ref(false);
const showShareConfirmModal = ref(false);
const dontShowShareWarning = ref(false);
const pendingShareAction = ref<(() => Promise<void>) | null>(null);

const SUPPRESS_KEY = "lumiar_share_explore_suppress";

function isShareSuppressed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SUPPRESS_KEY) === "true";
}

function withExploreCheck(fn: () => Promise<void>) {
  if (isShared.value || isShareSuppressed()) {
    fn();
    return;
  }
  pendingShareAction.value = fn;
  showShareConfirmModal.value = true;
}

async function handleShareModalConfirm() {
  if (dontShowShareWarning.value) localStorage.setItem(SUPPRESS_KEY, "true");
  showShareConfirmModal.value = false;
  await pendingShareAction.value?.();
  pendingShareAction.value = null;
}

function handleShareModalCancel() {
  showShareConfirmModal.value = false;
  pendingShareAction.value = null;
  dontShowShareWarning.value = false;
}

function handleShareClick() {
  if (isShared.value) showUnshareModal.value = true;
  else toggleShare();
}

const masonryAspect = computed(() => {
  if (!props.masonry) return null;
  const ar = props.generation.aspect_ratio;
  if (ar && ar !== "auto") {
    const [w, h] = ar.split(":").map(Number);
    if (w && h) return `${w} / ${h}`;
  }
  return "16 / 9";
});

const durationLabel = computed(() => `${props.generation.duration_seconds ?? 0}s`);

const isReady = computed(
  () =>
    (props.generation.status ?? "completed") === "completed" &&
    !!props.generation.output_video_url,
);

const likesCount = ref(
  props.generation._count?.likes ?? props.generation.likes?.length ?? 0,
);
const isLiked = ref(props.initialIsLiked ?? false);

function toggleLike() {
  isLiked.value = !isLiked.value;
  likesCount.value += isLiked.value ? 1 : -1;
}

function remix() {
  posthog?.capture("video_remixed", {
    generation_id: props.generation.id,
    source: "explore_card",
  });
  navigateTo({ path: "/video", query: { prompt: props.generation.prompt } });
}

async function toggleShare() {
  try {
    const { error } = await videoService.setVideoShared(
      props.generation.id,
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
    showUnshareModal.value = false;
  }
}

async function deleteVideo() {
  isDeleting.value = true;
  try {
    await $fetch(`/api/video-generations/${props.generation.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.value?.access_token ?? ""}` },
    });
    emit("deleted", props.generation.id);
    toast.add({ title: "Video deleted", color: "success" });
  } catch {
    toast.add({ title: "Failed to delete video", color: "error" });
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

const videoUrl = computed(
  () => `${window.location.origin}/video/${props.generation.id}`,
);

async function ensureExploreShared() {
  if (isShared.value) return;
  const { error } = await videoService.setVideoShared(props.generation.id, true);
  if (!error) {
    isShared.value = true;
    toast.add({
      title: "Your video is now public on Explore too",
      icon: "i-lucide-globe",
      color: "success",
    });
  }
}

async function copyLink() {
  await ensureExploreShared();
  await navigator.clipboard.writeText(videoUrl.value);
  toast.add({ title: "Link copied!", color: "success" });
}

async function shareOnX() {
  await ensureExploreShared();
  const text = `✨ AI video I made with Lumiar → ${videoUrl.value} #AIvideo #lumiar`;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer,width=550,height=420",
  );
}

async function shareOnWhatsApp() {
  await ensureExploreShared();
  const text = `✨ AI video I made with Lumiar → ${videoUrl.value} #AIvideo #lumiar`;
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

async function shareOnTelegram() {
  await ensureExploreShared();
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(videoUrl.value)}&text=${encodeURIComponent("✨ AI video I made with Lumiar #AIvideo #lumiar")}`,
    "_blank",
    "noopener,noreferrer",
  );
}

async function handleRemoveFromCollection() {
  if (!props.collectionId) return;
  isRemovingFromCollection.value = true;
  try {
    const { error } = await collectionService.removeFromCollection(
      props.collectionId,
      props.generation.id,
      "video",
    );
    if (error) throw error;
    emit("removedFromCollection", props.generation.id);
    toast.add({ title: "Removed from collection", color: "success" });
  } catch {
    toast.add({ title: "Failed to remove", color: "error" });
  } finally {
    isRemovingFromCollection.value = false;
  }
}

const dropdownItems = computed(() => {
  const groups: any[][] = [
    [
      {
        label: "Copy link",
        icon: "i-lucide-link",
        onSelect: () => withExploreCheck(copyLink),
      },
      {
        label: "Share on X",
        icon: "i-lucide-external-link",
        onSelect: () => withExploreCheck(shareOnX),
      },
      {
        label: "Share on WhatsApp",
        icon: "i-lucide-message-circle",
        onSelect: () => withExploreCheck(shareOnWhatsApp),
      },
      {
        label: "Share on Telegram",
        icon: "i-lucide-send",
        onSelect: () => withExploreCheck(shareOnTelegram),
      },
    ],
    [
      {
        label: "Add to collection",
        icon: "i-lucide-folder-plus",
        onSelect: () => {
          showCollectionPicker.value = true;
        },
      },
      {
        label: isShared.value ? "Unshare" : "Share to Explore",
        icon: isShared.value ? "i-lucide-eye-off" : "i-lucide-share-2",
        onSelect: handleShareClick,
      },
    ],
  ];
  if (props.collectionId) {
    groups.push([
      {
        label: isRemovingFromCollection.value
          ? "Removing…"
          : "Remove from collection",
        icon: "i-lucide-folder-minus",
        disabled: isRemovingFromCollection.value,
        onSelect: handleRemoveFromCollection,
      },
    ]);
  }
  groups.push([
    {
      label: isDeleting.value ? "Deleting…" : "Delete",
      icon: "i-lucide-trash-2",
      color: "error" as const,
      disabled: isDeleting.value,
      onSelect: () => {
        showDeleteModal.value = true;
      },
    },
  ]);
  return groups;
});
</script>

<template>
  <div
    class="group relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 transition-all duration-300 hover:shadow-xl hover:shadow-zinc-300/50 dark:hover:shadow-black/50 hover:-translate-y-0.5"
    :class="fill ? 'h-full' : ''"
  >
    <!-- Lightweight static preview; clicking opens the detail modal (no inline
         <video> in the feed keeps it fast). -->
    <button
      class="block w-full text-left"
      :class="fill ? 'h-full' : ''"
      @click="emit('preview', generation.id)"
    >
      <div
        class="relative overflow-hidden bg-zinc-950"
        :class="fill ? 'h-full' : !masonry ? 'aspect-video' : ''"
        :style="
          !fill && masonryAspect ? { aspectRatio: masonryAspect } : undefined
        "
      >
        <img
          v-if="generation.thumbnail_url"
          :src="generation.thumbnail_url"
          :alt="generation.prompt"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div
          v-else
          class="absolute inset-0 bg-gradient-to-br from-indigo-500/25 via-violet-500/20 to-fuchsia-500/25"
        />

        <!-- Play / generating affordance -->
        <div class="absolute inset-0 flex items-center justify-center">
          <span
            v-if="isReady"
            class="flex size-14 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-transform group-hover:scale-110"
          >
            <UIcon name="i-lucide-play" class="size-6 translate-x-0.5" />
          </span>
          <span
            v-else
            class="flex flex-col items-center gap-2 text-white/90"
          >
            <UIcon name="i-lucide-loader-2" class="size-7 animate-spin" />
            <span class="text-xs font-medium">Generating…</span>
          </span>
        </div>
      </div>
    </button>

    <!-- Duration badge -->
    <div
      class="pointer-events-none absolute top-2 flex items-center gap-1 h-6 px-2 rounded-full bg-black/55 text-white backdrop-blur-md text-[11px] font-medium"
      :class="isOwner ? 'right-11' : 'right-2'"
    >
      <UIcon name="i-lucide-video" class="size-3" />
      {{ durationLabel }}
    </div>

    <!-- Remix -->
    <button
      aria-label="Remix this video"
      title="Remix — start a new video from this prompt"
      class="absolute top-2 left-2 z-10 flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-xs font-medium"
      @click.prevent.stop="remix"
    >
      <UIcon name="i-lucide-shuffle" class="size-3.5" />
      Remix
    </button>

    <!-- Owner actions -->
    <UDropdownMenu v-if="isOwner" :items="dropdownItems">
      <button
        aria-label="Video actions"
        class="absolute top-2 right-2 z-10 size-8 rounded-full flex items-center justify-center bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
        @click.prevent
      >
        <UIcon name="i-lucide-more-horizontal" class="size-4" />
      </button>
    </UDropdownMenu>

    <!-- Author / prompt + like -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 p-3 flex items-end gap-2 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300"
    >
      <NuxtLink
        v-if="showAuthor && generation.profiles"
        :to="`/profile/${generation.profiles.username}`"
        class="pointer-events-auto flex items-center gap-1.5 min-w-0 flex-1"
        @click.stop
      >
        <UAvatar
          :src="generation.profiles.avatar_url || undefined"
          :fallback="generation.profiles.username?.slice(0, 1).toUpperCase() || '?'"
          size="2xs"
          class="flex-shrink-0 ring-1 ring-white/40"
        />
        <span
          class="text-xs font-medium text-white truncate leading-tight drop-shadow"
        >
          {{ generation.profiles.username }}
        </span>
      </NuxtLink>
      <p
        v-else
        class="text-xs text-white/90 line-clamp-2 leading-snug drop-shadow flex-1 min-w-0"
      >
        {{ generation.prompt }}
      </p>

      <button
        class="pointer-events-auto flex items-center gap-1 text-xs font-medium shrink-0 drop-shadow transition-colors"
        :class="isLiked ? 'text-red-400' : 'text-white hover:text-red-300'"
        @click.prevent="toggleLike"
      >
        <UIcon
          name="i-lucide-heart"
          class="size-3.5"
          :class="isLiked ? 'fill-red-400' : 'fill-none'"
        />
        {{ likesCount }}
      </button>
    </div>

    <CollectionPickerModal
      v-model:open="showCollectionPicker"
      :generation-id="generation.id"
      :generation-image-url="generation.thumbnail_url || undefined"
      media-type="video"
    />

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
      @confirm="toggleShare"
    />

    <UModal v-model:open="showShareConfirmModal">
      <template #content>
        <div>
          <div
            class="px-4 py-5 sm:px-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between"
          >
            <h3
              class="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2"
            >
              <UIcon name="i-lucide-globe" class="size-5 text-primary" />
              Share this video?
            </h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="-my-1"
              @click="handleShareModalCancel"
            />
          </div>

          <div class="px-4 py-5 sm:p-6 space-y-4">
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              Sharing this video will also make it
              <span class="font-medium text-zinc-700 dark:text-zinc-300"
                >publicly visible on Explore</span
              >
              so anyone with the link can view it.
            </p>
            <label
              class="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <input
                v-model="dontShowShareWarning"
                type="checkbox"
                class="size-4 rounded border-zinc-300 dark:border-zinc-600 accent-primary cursor-pointer"
              />
              <span
                class="text-sm text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors"
                >Don't show this again</span
              >
            </label>
          </div>

          <div
            class="px-4 py-4 sm:px-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3"
          >
            <UButton
              color="neutral"
              variant="outline"
              @click="handleShareModalCancel"
            >
              Cancel
            </UButton>
            <UButton color="primary" @click="handleShareModalConfirm">
              Continue & Share
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
