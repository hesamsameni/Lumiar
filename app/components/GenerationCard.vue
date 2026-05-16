<script setup lang="ts">
import { useSocialService } from "~/services/social.service";
import { useGenerationService } from "~/services/generation.service";

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
}>();

const emit = defineEmits<{
  deleted: [id: string];
  shareToggled: [id: string, isShared: boolean];
}>();

const { user: authUser, session } = useAuthState();
const socialService = useSocialService();
const generationService = useGenerationService();
const toast = useToast();

const likesCount = ref(
  props.generation._count?.likes ?? props.generation.likes?.length ?? 0,
);
const isLiked = ref(false);
const isTogglingLike = ref(false);
const isShared = ref(props.generation.is_shared ?? false);
const isTogglingShare = ref(false);
const isDeleting = ref(false);

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
    confirmingDelete.value = false;
  }
}

onMounted(() => checkLiked());
</script>

<template>
  <div
    class="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all hover:shadow-md hover:-translate-y-0.5"
  >
    <!-- Image -->
    <NuxtLink :to="`/generation/${generation.id}`" class="block">
      <div class="aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          :src="generation.output_image_url"
          :alt="generation.prompt"
          class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          loading="lazy"
        />
      </div>
    </NuxtLink>

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
      <UDropdownMenu
        v-if="isOwner"
        :items="[
          [
            {
              label: isShared ? 'Unshare' : 'Share to Explore',
              icon: isShared ? 'i-lucide-eye-off' : 'i-lucide-share-2',
              onSelect: toggleShare,
            },
          ],
          [
            {
              label: isDeleting ? 'Deleting…' : 'Delete',
              icon: 'i-lucide-trash-2',
              color: 'error',
              disabled: isDeleting,
              onSelect: deleteGeneration,
            },
          ],
        ]"
      >
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
  </div>
</template>
