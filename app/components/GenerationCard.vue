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
}>();

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

const likesCount = ref(
  props.generation._count?.likes ?? props.generation.likes?.length ?? 0,
);
const isLiked = ref(false);
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

onMounted(() => checkLiked());
</script>

<template>
  <div
    class="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all hover:shadow-md"
  >
    <!-- Image -->
    <button
      class="block w-full text-left"
      @click="emit('preview', generation.id)"
    >
      <div class="aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          :src="generation.output_image_url"
          :alt="generation.prompt"
          class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          loading="lazy"
        />
      </div>
    </button>

    <!-- Bottom bar -->
    <div class="px-3 py-2.5 flex items-center gap-2">
      <template v-if="showAuthor && generation.profiles">
        <NuxtLink
          :to="`/profile/${generation.profiles.username}`"
          class="flex items-center gap-1.5 min-w-0 flex-1"
        >
          <UAvatar
            :src="generation.profiles.avatar_url || undefined"
            :fallback="
              generation.profiles.username?.slice(0, 1).toUpperCase() || '?'
            "
            size="2xs"
            class="flex-shrink-0"
          />
          <span
            class="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate leading-tight"
          >
            {{ generation.profiles.username }}
          </span>
        </NuxtLink>
      </template>
      <div v-else class="flex-1 min-w-0">
        <p
          class="text-xs text-zinc-500 dark:text-zinc-400 truncate leading-tight"
          :style="rtlStyle(generation.prompt)"
          :dir="hasRtlChars(generation.prompt) ? 'rtl' : 'ltr'"
        >
          {{ generation.prompt }}
        </p>
      </div>

      <!-- Owner actions dropdown -->
      <UDropdownMenu v-if="isOwner" :items="dropdownItems">
        <button
          class="size-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
          @click.prevent
        >
          <UIcon name="i-lucide-more-horizontal" class="size-3.5" />
        </button>
      </UDropdownMenu>

      <!-- Like button -->
      <button
        class="flex items-center gap-1 text-xs flex-shrink-0 transition-colors"
        :class="
          isLiked
            ? 'text-red-500'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-red-400'
        "
        :disabled="isTogglingLike"
        @click.prevent="toggleLike"
      >
        <UIcon
          name="i-lucide-heart"
          class="size-3.5"
          :class="isLiked ? 'fill-red-500' : 'fill-none'"
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
