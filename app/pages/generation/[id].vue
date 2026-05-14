<script setup lang="ts">
import { getModelById } from "~/utils/models";
import { useGenerationService } from "~/services/generation.service";
import { useProfileService } from "~/services/profile.service";
import { useSocialService } from "~/services/social.service";

const route = useRoute();
const user = useSupabaseUser();
const toast = useToast();
const router = useRouter();
const generationService = useGenerationService();
const profileService = useProfileService();
const socialService = useSocialService();

const id = computed(() => route.params.id as string);
const generation = ref<Record<string, unknown> | null>(null);
const comments = ref<Record<string, unknown>[]>([]);
const loading = ref(true);
const commentText = ref("");
const isPostingComment = ref(false);
const likesCount = ref(0);
const isLiked = ref(false);
const isTogglingLike = ref(false);

type ProfileLite = {
  id: string;
  username: string;
  avatar_url: string | null;
};

async function fetchProfilesMap(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return {} as Record<string, ProfileLite>;

  const { data } = await profileService.getProfilesLiteByIds(uniqueIds);

  return Object.fromEntries(
    ((data ?? []) as ProfileLite[]).map((p) => [p.id, p]),
  );
}

const model = computed(() =>
  generation.value ? getModelById(generation.value.model_id as string) : null,
);

async function fetchGeneration() {
  const { data } = await generationService.getGenerationById(id.value);

  if (data) {
    const generationRow = data as Record<string, unknown> & { user_id: string };
    const profilesById = await fetchProfilesMap([generationRow.user_id]);
    const author = profilesById[generationRow.user_id];
    generation.value = {
      ...generationRow,
      profiles: author
        ? { username: author.username, avatar_url: author.avatar_url }
        : undefined,
    };
  } else {
    generation.value = null;
  }

  const { count } = await socialService.getLikesCount(id.value);
  likesCount.value = count ?? 0;

  if (user.value?.id) {
    const { data: likeData } = await socialService.getLikeByUser(
      id.value,
      user.value.id,
    );
    isLiked.value = !!likeData;
  }
}

async function fetchComments() {
  const { data } = await socialService.getCommentsByGeneration(id.value);

  const rows = (data ?? []) as Array<
    { user_id: string } & Record<string, unknown>
  >;
  const profilesById = await fetchProfilesMap(rows.map((row) => row.user_id));
  comments.value = rows.map((row) => {
    const author = profilesById[row.user_id];

    return {
      ...row,
      profiles: author
        ? { username: author.username, avatar_url: author.avatar_url }
        : undefined,
    };
  });
}

async function postComment() {
  if (!user.value?.id) {
    toast.add({ title: "Sign in to comment", color: "warning" });
    return;
  }
  if (!commentText.value.trim()) return;
  isPostingComment.value = true;
  const { data, error } = await socialService.addComment(
    id.value,
    user.value.id,
    commentText.value.trim(),
  );
  isPostingComment.value = false;
  if (error) {
    toast.add({ title: "Failed to post comment", color: "error" });
  } else {
    const profilesById = await fetchProfilesMap([user.value.id]);
    const author = profilesById[user.value.id];
    comments.value.push({
      ...(data as Record<string, unknown>),
      profiles: author
        ? { username: author.username, avatar_url: author.avatar_url }
        : undefined,
    });
    commentText.value = "";
  }
}

async function deleteComment(commentId: string) {
  await socialService.deleteComment(commentId);
  comments.value = comments.value.filter(
    (c) => (c as { id: string }).id !== commentId,
  );
}

async function toggleLike() {
  if (!user.value?.id) {
    toast.add({ title: "Sign in to like", color: "warning" });
    return;
  }
  isTogglingLike.value = true;
  if (isLiked.value) {
    await socialService.unlikeGeneration(id.value, user.value.id);
    likesCount.value--;
  } else {
    await socialService.likeGeneration(id.value, user.value.id);
    likesCount.value++;
  }
  isLiked.value = !isLiked.value;
  isTogglingLike.value = false;
}

async function downloadImage() {
  if (!generation.value) return;
  const a = document.createElement("a");
  a.href = generation.value.output_image_url as string;
  a.download = `lumiar-${id.value}.png`;
  a.target = "_blank";
  a.click();
}

function useAsBase() {
  router.push({ path: "/", query: { edit: id.value } });
}

onMounted(async () => {
  await Promise.all([fetchGeneration(), fetchComments()]);
  loading.value = false;
});
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <UButton
      icon="i-lucide-arrow-left"
      variant="ghost"
      color="neutral"
      size="sm"
      class="mb-6"
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

    <template v-else-if="generation">
      <div class="grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          <div
            class="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
          >
            <img
              :src="generation.output_image_url as string"
              :alt="generation.prompt as string"
              class="w-full object-contain max-h-[70vh]"
            />
          </div>

          <div class="flex flex-wrap gap-2 mt-4">
            <UButton
              icon="i-lucide-download"
              variant="outline"
              color="neutral"
              size="sm"
              @click="downloadImage"
            >
              Download
            </UButton>
            <UButton
              icon="i-lucide-pencil"
              variant="outline"
              color="neutral"
              size="sm"
              @click="useAsBase"
            >
              Edit this image
            </UButton>
            <UButton
              :icon="isLiked ? 'i-lucide-heart' : 'i-lucide-heart'"
              :variant="isLiked ? 'solid' : 'outline'"
              :color="isLiked ? 'error' : 'neutral'"
              size="sm"
              :loading="isTogglingLike"
              @click="toggleLike"
            >
              {{ likesCount }} {{ likesCount === 1 ? "like" : "likes" }}
            </UButton>
          </div>
        </div>

        <div class="space-y-6">
          <div>
            <NuxtLink
              v-if="generation.profiles"
              :to="`/profile/${(generation.profiles as { username: string }).username}`"
              class="flex items-center gap-2 mb-3 group"
            >
              <UAvatar
                :src="
                  (generation.profiles as { avatar_url?: string }).avatar_url
                "
                :fallback="
                  (generation.profiles as { username: string }).username
                    ?.slice(0, 2)
                    .toUpperCase()
                "
                size="sm"
              />
              <span
                class="text-sm font-medium group-hover:text-primary transition-colors"
              >
                {{ (generation.profiles as { username: string }).username }}
              </span>
            </NuxtLink>

            <div class="space-y-3 text-sm">
              <div>
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1"
                >
                  Prompt
                </p>
                <p class="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {{ generation.prompt }}
                </p>
              </div>
              <div v-if="model" class="flex items-center gap-2">
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide"
                >
                  Model
                </p>
                <span class="text-xs font-medium">{{ model.name }}</span>
              </div>
              <div
                v-if="
                  (generation.metadata as { tags?: string[] })?.tags?.length
                "
              >
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1"
                >
                  Tags
                </p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in (generation.metadata as { tags: string[] })
                      .tags"
                    :key="tag"
                    class="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 class="font-medium text-sm mb-3">
              Comments
              <span class="text-zinc-400 ml-1">{{ comments.length }}</span>
            </h3>

            <div class="space-y-3 max-h-64 overflow-y-auto mb-4">
              <div
                v-for="comment in comments"
                :key="(comment as { id: string }).id"
                class="flex gap-2"
              >
                <UAvatar
                  :src="
                    (comment.profiles as { avatar_url?: string })?.avatar_url
                  "
                  :fallback="
                    (comment.profiles as { username: string })?.username
                      ?.slice(0, 2)
                      .toUpperCase()
                  "
                  size="2xs"
                  class="flex-shrink-0 mt-0.5"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <NuxtLink
                      :to="`/profile/${(comment.profiles as { username: string })?.username}`"
                      class="text-xs font-medium hover:text-primary transition-colors"
                    >
                      {{ (comment.profiles as { username: string })?.username }}
                    </NuxtLink>
                    <span class="text-xs text-zinc-400 dark:text-zinc-500">
                      {{
                        new Date(
                          (comment as { created_at: string }).created_at,
                        ).toLocaleDateString()
                      }}
                    </span>
                    <button
                      v-if="
                        user?.id === (comment as { user_id: string }).user_id
                      "
                      class="ml-auto text-xs text-zinc-400 hover:text-red-500 transition-colors"
                      @click="deleteComment((comment as { id: string }).id)"
                    >
                      <UIcon name="i-lucide-trash-2" class="size-3" />
                    </button>
                  </div>
                  <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {{ (comment as { content: string }).content }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex gap-2">
              <UInput
                v-model="commentText"
                placeholder="Add a comment…"
                class="flex-1"
                @keydown.enter="postComment"
              />
              <UButton
                icon="i-lucide-send"
                size="sm"
                :loading="isPostingComment"
                :disabled="!commentText.trim()"
                @click="postComment"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="text-center py-20">
      <UIcon
        name="i-lucide-image-off"
        class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
      />
      <p class="text-zinc-500 dark:text-zinc-400">Generation not found</p>
    </div>
  </div>
</template>
