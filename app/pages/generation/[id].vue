<script setup lang="ts">
import { useGenerationService } from "~/services/generation.service";
import { useProfileService } from "~/services/profile.service";
import { useSocialService } from "~/services/social.service";
import { downloadImageToDevice } from "~/utils/download";

const route = useRoute();

type GenerationMeta = {
  imageUrl: string;
  prompt: string;
  username: string | null;
};

const { data: ogMeta } = await useAsyncData<GenerationMeta>(
  `gen-meta-${route.params.id}`,
  () =>
    $fetch<GenerationMeta>(
      `/api/generations/${route.params.id as string}/meta`,
    ),
  { server: true },
);

useSeoMeta({
  title: () => (ogMeta.value ? `${ogMeta.value.prompt} — Lumiar` : "Lumiar"),
  ogTitle: () => (ogMeta.value ? `${ogMeta.value.prompt} — Lumiar` : "Lumiar"),
  ogDescription: () =>
    ogMeta.value
      ? `AI image by @${ogMeta.value.username ?? "a user"}, made with Lumiar`
      : "AI-generated image on Lumiar",
  ogImage: () => ogMeta.value?.imageUrl ?? undefined,
  twitterCard: "summary_large_image",
  twitterImage: () => ogMeta.value?.imageUrl ?? undefined,
});

const { user: authUser, session } = useAuthState();
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
const isOwner = computed(
  () =>
    !!authUser.value?.id &&
    authUser.value.id === (generation.value?.user_id as string | undefined),
);
const isShared = ref(false);
const isTogglingShare = ref(false);
const isDeleting = ref(false);
const showDeleteModal = ref(false);
const showUnshareModal = ref(false);
const fullscreenImageUrl = ref<string | null>(null);

const referenceImages = computed(() => {
  if (!generation.value) return [];
  const urls: string[] = [];
  if (generation.value.input_image_url) {
    urls.push(generation.value.input_image_url as string);
  }
  const metadataUrls = (
    generation.value.metadata as { input_image_urls?: string[] }
  )?.input_image_urls;
  if (Array.isArray(metadataUrls)) {
    metadataUrls.forEach((url) => {
      if (!urls.includes(url)) urls.push(url);
    });
  }
  return urls;
});

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

const { getModelById } = useModels();
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

  if (authUser.value?.id) {
    const { data: likeData } = await socialService.getLikeByUser(
      id.value,
      authUser.value.id,
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
  if (!authUser.value?.id) {
    toast.add({ title: "Sign in to comment", color: "warning" });
    return;
  }
  if (!commentText.value.trim()) return;
  isPostingComment.value = true;
  const { data, error } = await socialService.addComment(
    id.value,
    authUser.value.id,
    commentText.value.trim(),
  );
  isPostingComment.value = false;
  if (error) {
    toast.add({ title: "Failed to post comment", color: "error" });
  } else {
    const profilesById = await fetchProfilesMap([authUser.value.id]);
    const author = profilesById[authUser.value.id];
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
  if (!authUser.value?.id) {
    toast.add({ title: "Sign in to like", color: "warning" });
    return;
  }
  isTogglingLike.value = true;
  if (isLiked.value) {
    await socialService.unlikeGeneration(id.value, authUser.value.id);
    likesCount.value--;
  } else {
    await socialService.likeGeneration(id.value, authUser.value.id);
    likesCount.value++;
  }
  isLiked.value = !isLiked.value;
  isTogglingLike.value = false;
}

async function downloadImage() {
  if (!generation.value) return;
  await downloadImageToDevice(
    generation.value.output_image_url as string,
    `lumiar-${id.value}.png`,
  );
}

function useAsBase() {
  router.push({ path: "/", query: { edit: id.value } });
}

async function toggleShare() {
  isTogglingShare.value = true;
  try {
    const { error } = await generationService.setGenerationShared(
      id.value,
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
    await $fetch(`/api/generations/${id.value}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.value?.access_token ?? ""}`,
      },
    });
    toast.add({ title: "Photo deleted", color: "success" });
    router.back();
  } catch {
    toast.add({ title: "Failed to delete photo", color: "error" });
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

onMounted(async () => {
  await Promise.all([fetchGeneration(), fetchComments()]);
  isShared.value = (generation.value?.is_shared as boolean) ?? false;
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
            class="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 group"
          >
            <img
              :src="generation.output_image_url as string"
              :alt="generation.prompt as string"
              class="w-full object-contain max-h-[70vh]"
            />
            <!-- Fullscreen button -->
            <button
              class="absolute top-3 right-3 size-9 rounded-xl bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-sm"
              title="View fullscreen"
              @click="
                fullscreenImageUrl = generation.output_image_url as string
              "
            >
              <UIcon name="i-lucide-maximize-2" class="size-4" />
            </button>
          </div>

          <!-- Fullscreen overlay -->
          <Teleport to="body">
            <Transition
              enter-active-class="transition-opacity duration-200"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition-opacity duration-150"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <div
                v-if="fullscreenImageUrl"
                class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
                @click="fullscreenImageUrl = null"
              >
                <button
                  class="absolute top-4 right-4 size-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                  @click.stop="fullscreenImageUrl = null"
                >
                  <UIcon name="i-lucide-x" class="size-5" />
                </button>
                <img
                  :src="fullscreenImageUrl"
                  :alt="generation.prompt as string"
                  class="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                  @click.stop
                />
              </div>
            </Transition>
          </Teleport>

          <!-- Primary actions -->
          <div class="flex gap-2 mt-4">
            <UButton
              icon="i-lucide-download"
              variant="solid"
              color="neutral"
              size="sm"
              class="flex-1"
              @click="downloadImage"
            >
              Download
            </UButton>
            <UButton
              icon="i-lucide-pencil"
              variant="outline"
              color="neutral"
              size="sm"
              class="flex-1"
              @click="useAsBase"
            >
              Edit
            </UButton>
          </div>

          <!-- Secondary actions -->
          <div
            class="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800"
          >
            <UButton
              icon="i-lucide-heart"
              size="xs"
              :variant="isLiked ? 'soft' : 'ghost'"
              :color="isLiked ? 'error' : 'neutral'"
              :loading="isTogglingLike"
              @click="toggleLike"
            >
              <span class="hidden sm:inline">
                {{ likesCount }} {{ likesCount === 1 ? "like" : "likes" }}
              </span>
            </UButton>
            <template v-if="isOwner">
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
              <SocialShareMenu
                :generation-id="id"
                :image-url="generation.output_image_url as string"
                :prompt="generation.prompt as string"
                :is-shared="isShared"
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
            </template>
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
                  (generation.profiles as { avatar_url?: string }).avatar_url ||
                  undefined
                "
                :fallback="
                  (generation.profiles as { username: string }).username
                    ?.slice(0, 1)
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
              <div v-if="isOwner && referenceImages.length > 0" class="mb-4">
                <div class="flex items-center gap-2 mb-2">
                  <p
                    class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide"
                  >
                    Reference Images
                  </p>
                  <span
                    class="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
                  >
                    <UIcon name="i-lucide-lock" class="size-3" />
                    Only visible to you
                  </span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="(url, idx) in referenceImages"
                    :key="idx"
                    class="relative group rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 size-16 flex-shrink-0"
                    @click="fullscreenImageUrl = url"
                  >
                    <img
                      :src="url"
                      alt="Reference image"
                      class="w-full h-full object-cover"
                    />
                    <div
                      class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"
                    >
                      <UIcon
                        name="i-lucide-maximize-2"
                        class="size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
                      />
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1"
                >
                  {{
                    ((generation.metadata as { prompt_chain?: string[] })
                      ?.prompt_chain?.length ?? 0) > 1
                      ? "Prompt History"
                      : "Prompt"
                  }}
                </p>
                <template
                  v-if="
                    ((generation.metadata as { prompt_chain?: string[] })
                      ?.prompt_chain?.length ?? 0) > 1
                  "
                >
                  <div
                    v-for="(p, i) in (
                      generation.metadata as { prompt_chain: string[] }
                    ).prompt_chain"
                    :key="i"
                    class="mb-2 pl-3 border-l-2"
                    :class="
                      i === 0
                        ? 'border-zinc-300 dark:border-zinc-600'
                        : 'border-primary/60'
                    "
                  >
                    <span
                      class="text-xs font-medium"
                      :class="
                        i === 0
                          ? 'text-zinc-400 dark:text-zinc-500'
                          : 'text-primary'
                      "
                    >
                      {{ i === 0 ? "Original" : `Edit ${i}` }}
                    </span>
                    <p
                      class="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-0.5"
                      :style="rtlStyle(p)"
                      :dir="hasRtlChars(p) ? 'rtl' : 'ltr'"
                    >
                      {{ p }}
                    </p>
                  </div>
                </template>
                <p
                  v-else
                  class="text-zinc-700 dark:text-zinc-300 leading-relaxed"
                  :style="rtlStyle(generation.prompt as string)"
                  :dir="
                    hasRtlChars(generation.prompt as string) ? 'rtl' : 'ltr'
                  "
                >
                  {{ generation.prompt }}
                </p>
              </div>
              <div v-if="model" class="flex items-center gap-2">
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide"
                >
                  Model
                </p>
                <span
                  class="inline-flex items-center text-xs px-2 py-0.5 rounded-lg font-medium"
                  :class="{
                    'bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400':
                      model.tier === 'high',
                    'bg-blue-500/15 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400':
                      model.tier === 'mid',
                    'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400':
                      model.tier === 'low',
                  }"
                >
                  {{ model.name }}
                </span>
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
                    (comment.profiles as { avatar_url?: string })?.avatar_url ||
                    undefined
                  "
                  :fallback="
                    (comment.profiles as { username: string })?.username
                      ?.slice(0, 1)
                      .toUpperCase() || '?'
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
                        authUser?.id ===
                        (comment as { user_id: string }).user_id
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
  </div>
</template>
