<script setup lang="ts">
import { useSocialService } from "~/services/social.service";
import { useProfile } from "~/composables/useProfile";

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
}>();

const { user: authUser } = useAuthState();
const socialService = useSocialService();
const toast = useToast();
const likesCount = ref(
  props.generation._count?.likes ?? props.generation.likes?.length ?? 0,
);
const isLiked = ref(false);
const isTogglingLike = ref(false);

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

onMounted(() => checkLiked());
</script>

<template>
  <div
    class="group relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:shadow-lg transition-all"
  >
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

    <div class="p-3">
      <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-2">
        {{ generation.prompt }}
      </p>

      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <template v-if="showAuthor && generation.profiles">
            <NuxtLink
              :to="`/profile/${generation.profiles.username}`"
              class="flex items-center gap-1.5 min-w-0"
            >
              <UAvatar
                :src="generation.profiles.avatar_url"
                :fallback="
                  generation.profiles.username?.slice(0, 2).toUpperCase()
                "
                size="2xs"
              />
              <span class="text-xs text-zinc-500 dark:text-zinc-400 truncate">{{
                generation.profiles.username
              }}</span>
            </NuxtLink>
          </template>
          <div
            v-if="generation.metadata?.tags?.length"
            class="flex gap-1 flex-wrap"
          >
            <span
              v-for="tag in generation.metadata.tags.slice(0, 2)"
              :key="tag"
              class="text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            >
              {{ tag }}
            </span>
          </div>
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
            :name="isLiked ? 'i-lucide-heart' : 'i-lucide-heart'"
            class="size-3.5"
          />
          {{ likesCount }}
        </button>
      </div>
    </div>
  </div>
</template>
