<script setup lang="ts">
import { useSocialService } from "~/services/social.service";
import { useGenerationService } from "~/services/generation.service";
import { useCollectionService } from "~/services/collection.service";

interface Generation {
  id: string;
  output_image_url: string;
  prompt: string;
  model_name: string;
  created_at: string;
  is_shared: boolean;
  aspect_ratio?: string;
  metadata?: { tags?: string[] };
  profiles?: { username: string; avatar_url?: string };
  likes?: { id: string }[];
  _count?: { likes: number; comments: number };
}

const props = defineProps<{
  generation: Generation;
  showAuthor?: boolean;
  isOwner?: boolean;
  collectionId?: string;
  initialIsLiked?: boolean;
  masonry?: boolean;
  // Fill the parent cell (mosaic grid) instead of reserving the aspect ratio.
  fill?: boolean;
  // Show the "Remix" quick action (hidden e.g. in the Studio grid).
  showRemix?: boolean;
}>();

const imgLoaded = ref(false);

// In masonry mode, always reserve the card height so the grid never reflows
// (or flickers) as images load. Uses the stored aspect ratio when known, and a
// square fallback otherwise.
const masonryAspect = computed(() => {
  if (!props.masonry) return null;
  const ar = props.generation.aspect_ratio;
  if (ar && ar !== "auto") {
    const [w, h] = ar.split(":").map(Number);
    if (w && h) return `${w} / ${h}`;
  }
  return "1 / 1";
});

const emit = defineEmits<{
  deleted: [id: string];
  shareToggled: [id: string, isShared: boolean];
  removedFromCollection: [id: string];
  preview: [id: string];
}>();

const { user: authUser, session } = useAuthState();
const socialService = useSocialService();
const generationService = useGenerationService();
const collectionService = useCollectionService();
const toast = useToast();
const posthog = usePostHog();

function remix() {
  posthog?.capture("generation_remixed", {
    generation_id: props.generation.id,
    source: "explore_card",
  });
  navigateTo({ path: "/", query: { prompt: props.generation.prompt } });
}

const likesCount = ref(
  props.generation._count?.likes ?? props.generation.likes?.length ?? 0,
);
const isLiked = ref(props.initialIsLiked ?? false);
const isTogglingLike = ref(false);
const isShared = ref(props.generation.is_shared ?? false);
const isTogglingShare = ref(false);
const isDeleting = ref(false);
const showDeleteModal = ref(false);
const showUnshareModal = ref(false);
const showShareConfirmModal = ref(false);
const dontShowShareWarning = ref(false);
const pendingShareAction = ref<(() => Promise<void>) | null>(null);
const showCollectionPicker = ref(false);
const isRemovingFromCollection = ref(false);

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

async function checkLiked() {
  if (!authUser.value?.id) return;
  const { data } = await socialService.getLikeByUser(
    props.generation.id,
    authUser.value.id,
  );
  isLiked.value = !!data;
}

async function toggleLike() {
  if (!authUser.value?.id) {
    toast.add({ title: "Sign in to like", color: "warning" });
    return;
  }
  isTogglingLike.value = true;
  try {
    if (isLiked.value) {
      await socialService.unlikeGeneration(
        props.generation.id,
        authUser.value.id,
      );
      likesCount.value--;
    } else {
      await socialService.likeGeneration(
        props.generation.id,
        authUser.value.id,
      );
      likesCount.value++;
    }
    isLiked.value = !isLiked.value;
  } catch {
    toast.add({ title: "Failed to update like", color: "error" });
  } finally {
    isTogglingLike.value = false;
  }
}

async function toggleShare() {
  isTogglingShare.value = true;
  try {
    const { error } = await generationService.setGenerationShared(
      props.generation.id,
      !isShared.value,
    );
    if (error) throw error;
    isShared.value = !isShared.value;
    emit("shareToggled", props.generation.id, isShared.value);
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

function handleShareClick() {
  if (isShared.value) {
    showUnshareModal.value = true;
  } else {
    toggleShare();
  }
}

async function deleteGeneration() {
  isDeleting.value = true;
  try {
    await $fetch(`/api/generations/${props.generation.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.value?.access_token ?? ""}` },
    });
    emit("deleted", props.generation.id);
    toast.add({ title: "Photo deleted", color: "success" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[deleteGeneration] failed:", err);
    toast.add({
      title: "Failed to delete photo",
      description: msg,
      color: "error",
    });
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

async function handleRemoveFromCollection() {
  if (!props.collectionId) return;
  isRemovingFromCollection.value = true;
  try {
    const { error } = await collectionService.removeFromCollection(
      props.collectionId,
      props.generation.id,
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

async function ensureExploreShared() {
  if (isShared.value) return;
  const { error } = await generationService.setGenerationShared(
    props.generation.id,
    true,
  );
  if (!error) {
    isShared.value = true;
    emit("shareToggled", props.generation.id, true);
    toast.add({
      title: "Your image is now public on Explore too",
      icon: "i-lucide-globe",
      color: "success",
    });
  }
}

async function copyGenerationLink() {
  await ensureExploreShared();
  const url = `${window.location.origin}/generation/${props.generation.id}`;
  await navigator.clipboard.writeText(url);
  toast.add({ title: "Link copied!", icon: "i-lucide-link", color: "success" });
}

async function shareOnX() {
  await ensureExploreShared();
  const url = `${window.location.origin}/generation/${props.generation.id}`;
  const text = `✨ AI art I made with Lumiar → ${url} #AIart #lumiar`;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer,width=550,height=420",
  );
}

async function shareOnWhatsApp() {
  await ensureExploreShared();
  const url = `${window.location.origin}/generation/${props.generation.id}`;
  const text = `✨ AI art I made with Lumiar → ${url} #AIart #lumiar`;
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

async function shareOnTelegram() {
  await ensureExploreShared();
  const url = `${window.location.origin}/generation/${props.generation.id}`;
  const text = `✨ AI art I made with Lumiar #AIart #lumiar`;
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

const dropdownItems = computed(() => {
  const groups: any[][] = [
    [
      {
        label: "Copy link",
        icon: "i-lucide-link",
        onSelect: () => withExploreCheck(copyGenerationLink),
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
      color: "error",
      disabled: isDeleting.value,
      onSelect: () => {
        showDeleteModal.value = true;
      },
    },
  ]);
  return groups;
});

onMounted(() => {
  if (props.initialIsLiked === undefined) checkLiked();
});
</script>

<template>
  <div
    class="group relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 transition-all duration-300 hover:shadow-xl hover:shadow-zinc-300/50 dark:hover:shadow-black/50 hover:-translate-y-0.5"
    :class="fill ? 'h-full' : ''"
  >
    <!-- Image (preview trigger) -->
    <button
      class="block w-full text-left"
      :class="fill ? 'h-full' : ''"
      @click="emit('preview', generation.id)"
    >
      <div
        class="relative overflow-hidden bg-zinc-100 dark:bg-zinc-800"
        :class="fill ? 'h-full' : !masonry ? 'aspect-square' : ''"
        :style="
          !fill && masonryAspect ? { aspectRatio: masonryAspect } : undefined
        "
      >
        <img
          :src="generation.output_image_url"
          :alt="generation.prompt"
          class="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.04]"
          :class="imgLoaded ? 'opacity-100' : 'opacity-0'"
          loading="lazy"
          @load="imgLoaded = true"
        />
      </div>
    </button>

    <!-- Gradient scrim (visible on mobile, reveals on hover for desktop) -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300"
    />

    <!-- Remix (top-left, glass) -->
    <button
      v-if="showRemix !== false"
      aria-label="Remix this image"
      title="Remix — start a new image from this prompt"
      class="absolute top-2 left-2 flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-xs font-medium"
      @click.prevent.stop="remix"
    >
      <UIcon name="i-lucide-shuffle" class="size-3.5" />
      Remix
    </button>

    <!-- Owner actions (top-right, glass) -->
    <UDropdownMenu v-if="isOwner" :items="dropdownItems">
      <button
        aria-label="Image actions"
        class="absolute top-2 right-2 size-8 rounded-full flex items-center justify-center bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
        @click.prevent
      >
        <UIcon name="i-lucide-more-horizontal" class="size-4" />
      </button>
    </UDropdownMenu>

    <!-- Bottom info overlay -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 p-3 flex items-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300"
    >
      <NuxtLink
        v-if="showAuthor && generation.profiles"
        :to="`/profile/${generation.profiles.username}`"
        class="pointer-events-auto flex items-center gap-1.5 min-w-0 flex-1"
        @click.stop
      >
        <UAvatar
          :src="generation.profiles.avatar_url || undefined"
          :fallback="
            generation.profiles.username?.slice(0, 1).toUpperCase() || '?'
          "
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
        :style="rtlStyle(generation.prompt)"
        :dir="hasRtlChars(generation.prompt) ? 'rtl' : 'ltr'"
      >
        {{ generation.prompt }}
      </p>

      <!-- Like -->
      <button
        class="pointer-events-auto flex items-center gap-1 text-xs font-medium shrink-0 drop-shadow transition-colors"
        :class="isLiked ? 'text-red-400' : 'text-white hover:text-red-300'"
        :disabled="isTogglingLike"
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

    <!-- Modals -->
    <ConfirmModal
      v-model:open="showDeleteModal"
      title="Delete Image"
      description="Are you sure you want to delete this image? This action cannot be undone."
      confirm-text="Delete"
      confirm-color="error"
      icon="i-lucide-trash-2"
      :loading="isDeleting"
      @confirm="deleteGeneration"
    />

    <ConfirmModal
      v-model:open="showUnshareModal"
      title="Unshare Image"
      description="Are you sure you want to remove this image from the Explore feed? It will no longer be visible to other users."
      confirm-text="Unshare"
      confirm-color="primary"
      icon="i-lucide-eye-off"
      :loading="isTogglingShare"
      @confirm="toggleShare"
    />

    <CollectionPickerModal
      v-model:open="showCollectionPicker"
      :generation-id="generation.id"
      :generation-image-url="generation.output_image_url"
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
              Share this image?
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
              Sharing this image will also make it
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
