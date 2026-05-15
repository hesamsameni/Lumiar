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
const confirmingDelete = ref(false);

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
  if (!confirmingDelete.value) {
    confirmingDelete.value = true;
    setTimeout(() => {
      confirmingDelete.value = false;
    }, 3000);
    return;
  }
  isDeleting.value = true;
  try {
    await $fetch(`/api/generations/${props.generation.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.value?.access_token ?? ""}` },
    });
    emit("deleted", props.generation.id);
    toast.add({ title: "Photo deleted", color: "success" });
  } catch {
    toast.add({ title: "Failed to delete photo", color: "error" });
  } finally {
    isDeleting.value = false;
    confirmingDelete.value = false;
  }
}

onMounted(() => checkLiked());
</script>

<template>
  <div
    class="group relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:shadow-lg transition-all"
  >
    <!-- Image -->
    <NuxtLink :to="`/generation/${generation.id}`" class="block">
      <div class="aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          :src="generation.output_image_url"
          :alt="generation.prompt"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      </div>
    </NuxtLink>

    <!-- Hover overlay -->
    <div
      class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3"
    >
      <!-- Owner action buttons (top-right) -->
      <div v-if="isOwner" class="flex justify-end gap-1.5">
        <button
          class="flex items-center gap-1 text-xs px-2 py-1 rounded-lg backdrop-blur-sm transition-all"
          :class="
            isShared
              ? 'bg-primary text-white hover:bg-primary/80'
              : 'bg-white/20 text-white hover:bg-white/30'
          "
          :disabled="isTogglingShare"
          @click.prevent="toggleShare"
        >
          <UIcon
            :name="
              isTogglingShare
                ? 'i-lucide-loader-circle'
                : isShared
                  ? 'i-lucide-eye-off'
                  : 'i-lucide-share-2'
            "
            class="size-3"
            :class="isTogglingShare ? 'animate-spin' : ''"
          />
          <span>{{ isShared ? "Unshare" : "Share" }}</span>
        </button>

        <button
          class="flex items-center gap-1 text-xs px-2 py-1 rounded-lg backdrop-blur-sm transition-all"
          :class="
            confirmingDelete
              ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
              : 'bg-white/20 text-white hover:bg-red-500/80'
          "
          :disabled="isDeleting"
          @click.prevent="deleteGeneration"
        >
          <UIcon
            :name="isDeleting ? 'i-lucide-loader-circle' : 'i-lucide-trash-2'"
            class="size-3"
            :class="isDeleting ? 'animate-spin' : ''"
          />
          <span>{{ confirmingDelete ? "Confirm?" : "Delete" }}</span>
        </button>
      </div>
      <div v-else />

      <!-- Bottom: prompt + view -->
      <div class="flex flex-col gap-2">
        <p class="text-white/90 text-xs line-clamp-4 leading-relaxed">
          {{ generation.prompt }}
        </p>
        <NuxtLink :to="`/generation/${generation.id}`">
          <UButton size="xs" block icon="i-lucide-expand" color="neutral">
            View
          </UButton>
        </NuxtLink>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="p-2.5 flex items-center justify-between gap-2">
      <template v-if="showAuthor && generation.profiles">
        <NuxtLink
          :to="`/profile/${generation.profiles.username}`"
          class="flex items-center gap-1.5 min-w-0"
        >
          <UAvatar
            :src="generation.profiles.avatar_url"
            :fallback="generation.profiles.username?.slice(0, 2).toUpperCase()"
            size="2xs"
          />
          <span
            class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate leading-tight"
          >
            {{ generation.profiles.username }}
          </span>
        </NuxtLink>
      </template>
      <div v-else class="min-w-0 flex-1">
        <p
          class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate leading-tight"
        >
          {{ generation.model_name }}
        </p>
      </div>

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
