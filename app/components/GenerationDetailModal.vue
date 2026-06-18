<script setup lang="ts">
import { useGenerationService } from "~/services/generation.service";
import { useProfileService } from "~/services/profile.service";
import { useSocialService } from "~/services/social.service";
import { downloadImageToDevice } from "~/utils/download";

const props = defineProps<{
  open: boolean;
  generationId: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { user: authUser, session } = useAuthState();
const router = useRouter();
const generationService = useGenerationService();
const profileService = useProfileService();
const socialService = useSocialService();
const toast = useToast();
const { models, getModelById, fetchModels } = useModels();

const generation = ref<Record<string, unknown> | null>(null);
const comments = ref<Record<string, unknown>[]>([]);
const loading = ref(false);
const commentText = ref("");
const isPostingComment = ref(false);
const likesCount = ref(0);
const isLiked = ref(false);
const isTogglingLike = ref(false);
const isShared = ref(false);
const isTogglingShare = ref(false);
const showCollectionPicker = ref(false);
const showDeleteModal = ref(false);
const showUnshareModal = ref(false);
const isDeleting = ref(false);
const fullscreenImageUrl = ref<string | null>(null);

const model = computed(() =>
  generation.value ? getModelById(generation.value.model_id as string) : null,
);

const isOwner = computed(
  () =>
    !!authUser.value?.id &&
    authUser.value.id === (generation.value?.user_id as string | undefined),
);

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

async function fetchGeneration() {
  if (!props.generationId) return;
  loading.value = true;
  generation.value = null;
  comments.value = [];
  isShared.value = false;

  const { data } = await generationService.getGenerationById(
    props.generationId,
  );

  if (data) {
    const row = data as Record<string, unknown> & { user_id: string };
    const profilesById = await fetchProfilesMap([row.user_id]);
    const author = profilesById[row.user_id];
    generation.value = {
      ...row,
      profiles: author
        ? { username: author.username, avatar_url: author.avatar_url }
        : undefined,
    };
    isShared.value = (row.is_shared as boolean) ?? false;
  }

  const { count } = await socialService.getLikesCount(props.generationId!);
  likesCount.value = count ?? 0;

  if (authUser.value?.id) {
    const { data: likeData } = await socialService.getLikeByUser(
      props.generationId!,
      authUser.value.id,
    );
    isLiked.value = !!likeData;
  }

  const { data: commentsData } = await socialService.getCommentsByGeneration(
    props.generationId!,
  );
  const rows = (commentsData ?? []) as Array<
    { user_id: string } & Record<string, unknown>
  >;
  const profilesById = await fetchProfilesMap(rows.map((r) => r.user_id));
  comments.value = rows.map((row) => {
    const author = profilesById[row.user_id];
    return {
      ...row,
      profiles: author
        ? { username: author.username, avatar_url: author.avatar_url }
        : undefined,
    };
  });

  loading.value = false;
}

async function toggleLike() {
  if (!authUser.value?.id || !props.generationId) {
    toast.add({ title: "Sign in to like", color: "warning" });
    return;
  }
  isTogglingLike.value = true;
  if (isLiked.value) {
    await socialService.unlikeGeneration(props.generationId, authUser.value.id);
    likesCount.value--;
  } else {
    await socialService.likeGeneration(props.generationId, authUser.value.id);
    likesCount.value++;
  }
  isLiked.value = !isLiked.value;
  isTogglingLike.value = false;
}

async function toggleShare() {
  if (!props.generationId) return;
  isTogglingShare.value = true;
  try {
    const { error } = await generationService.setGenerationShared(
      props.generationId,
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
  if (isShared.value) showUnshareModal.value = true;
  else toggleShare();
}

async function deleteGeneration() {
  if (!props.generationId) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/generations/${props.generationId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.value?.access_token ?? ""}` },
    });
    toast.add({ title: "Photo deleted", color: "success" });
    emit("update:open", false);
  } catch {
    toast.add({ title: "Failed to delete photo", color: "error" });
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

async function downloadImage() {
  if (!generation.value || !props.generationId) return;
  await downloadImageToDevice(
    generation.value.output_image_url as string,
    `lumiar-${props.generationId}.png`,
  );
}

function useAsBase() {
  emit("update:open", false);
  router.push({ path: "/", query: { edit: props.generationId! } });
}

async function postComment() {
  if (!authUser.value?.id || !props.generationId) {
    toast.add({ title: "Sign in to comment", color: "warning" });
    return;
  }
  if (!commentText.value.trim()) return;
  isPostingComment.value = true;
  const { data, error } = await socialService.addComment(
    props.generationId,
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

watch(
  () => props.open,
  (open) => {
    if (open && props.generationId) {
      if (models.value.length === 0) fetchModels();
      fetchGeneration();
    }
  },
);
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-5xl lg:h-[85dvh] flex flex-col' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex flex-col max-h-[90dvh] overflow-hidden">
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0"
        >
          <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
            Generation Details
          </h3>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-external-link"
              size="xs"
              variant="ghost"
              color="neutral"
              :to="`/generation/${generationId}`"
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
        </div>

        <!-- Body -->
        <div class="overflow-y-auto lg:overflow-hidden flex-1 min-h-0">
          <!-- Loading -->
          <div v-if="loading" class="flex items-center justify-center py-20">
            <UIcon
              name="i-lucide-loader-circle"
              class="size-8 animate-spin text-primary"
            />
          </div>

          <template v-else-if="generation">
            <div class="flex flex-col lg:flex-row lg:h-full">
              <!-- Left: image + actions -->
              <div class="lg:flex-1 flex flex-col min-h-0">
                <!-- Image -->
                <div
                  class="flex-1 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6 min-h-[40vh] lg:min-h-0 lg:overflow-hidden relative group"
                >
                  <img
                    :src="generation.output_image_url as string"
                    :alt="generation.prompt as string"
                    class="max-w-full max-h-[35vh] lg:max-h-[75%] object-contain rounded-xl shadow-lg"
                  />
                  <button
                    class="absolute top-4 right-4 size-8 rounded-lg bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
                    @click="
                      fullscreenImageUrl = generation.output_image_url as string
                    "
                  >
                    <UIcon name="i-lucide-maximize-2" class="size-4" />
                  </button>
                </div>

                <!-- Primary actions -->
                <div
                  class="flex gap-2 px-4 pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex-shrink-0"
                >
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
                  class="flex items-center gap-1 px-4 pb-3 pt-1 flex-shrink-0 flex-wrap"
                >
                  <UButton
                    icon="i-lucide-heart"
                    size="xs"
                    :variant="isLiked ? 'soft' : 'ghost'"
                    :color="isLiked ? 'error' : 'neutral'"
                    :loading="isTogglingLike"
                    @click="toggleLike"
                  >
                    <span class="hidden sm:inline"
                      >{{ likesCount }}
                      {{ likesCount === 1 ? "like" : "likes" }}</span
                    >
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
                      :generation-id="generationId!"
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

              <!-- Details sidebar: fixed width, scrolls independently -->
              <div
                class="lg:w-72 xl:w-80 shrink-0 lg:overflow-y-auto p-4 space-y-4 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800"
              >
                <!-- Author -->
                <NuxtLink
                  v-if="generation.profiles"
                  :to="`/profile/${(generation.profiles as { username: string }).username}`"
                  class="flex items-center gap-2 group"
                  @click="emit('update:open', false)"
                >
                  <UAvatar
                    :src="
                      (generation.profiles as { avatar_url?: string })
                        .avatar_url || undefined
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

                <!-- Reference images (owner only) -->
                <div v-if="isOwner && referenceImages.length > 0">
                  <p
                    class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5"
                  >
                    Reference Images
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <img
                      v-for="(url, idx) in referenceImages"
                      :key="idx"
                      :src="url"
                      alt="Reference"
                      class="size-14 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                  </div>
                </div>

                <!-- Prompt -->
                <div>
                  <p
                    class="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1"
                  >
                    Prompt
                  </p>
                  <p
                    class="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed"
                    :style="rtlStyle(generation.prompt as string)"
                    :dir="
                      hasRtlChars(generation.prompt as string) ? 'rtl' : 'ltr'
                    "
                  >
                    {{ generation.prompt }}
                  </p>
                </div>

                <!-- Model -->
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

                <!-- Tags -->
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

                <!-- Actions -->
                <div
                  class="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800"
                >
                  <UButton
                    icon="i-lucide-heart"
                    size="xs"
                    :variant="isLiked ? 'soft' : 'ghost'"
                    :color="isLiked ? 'error' : 'neutral'"
                    :loading="isTogglingLike"
                    @click="toggleLike"
                  >
                    {{ likesCount }}
                  </UButton>
                </div>

                <!-- Comments -->
                <div>
                  <h4
                    class="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2"
                  >
                    Comments
                    <span class="text-zinc-400 ml-1">{{
                      comments.length
                    }}</span>
                  </h4>

                  <div class="space-y-2.5 max-h-40 overflow-y-auto mb-3">
                    <div
                      v-for="comment in comments"
                      :key="(comment as { id: string }).id"
                      class="flex gap-2"
                    >
                      <UAvatar
                        :src="
                          (comment.profiles as { avatar_url?: string })
                            ?.avatar_url || undefined
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
                          <span class="text-xs font-medium">
                            {{
                              (comment.profiles as { username: string })
                                ?.username
                            }}
                          </span>
                          <span class="text-[10px] text-zinc-400">
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
                            class="ml-auto text-xs text-zinc-400 hover:text-red-500"
                            @click="
                              deleteComment((comment as { id: string }).id)
                            "
                          >
                            <UIcon name="i-lucide-trash-2" class="size-3" />
                          </button>
                        </div>
                        <p
                          class="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5"
                        >
                          {{ (comment as { content: string }).content }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="flex gap-2">
                    <UInput
                      v-model="commentText"
                      placeholder="Add a comment…"
                      size="xs"
                      class="flex-1"
                      @keydown.enter="postComment"
                    />
                    <UButton
                      icon="i-lucide-send"
                      size="xs"
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
              class="size-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2"
            />
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              Generation not found
            </p>
          </div>
        </div>
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
            class="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
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
              :alt="generation?.prompt as string"
              class="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              @click.stop
            />
          </div>
        </Transition>
      </Teleport>
    </template>
  </UModal>

  <CollectionPickerModal
    v-if="generationId && generation"
    v-model:open="showCollectionPicker"
    :generation-id="generationId"
    :generation-image-url="(generation?.output_image_url as string) ?? ''"
  />

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
    description="Are you sure you want to remove this image from the Explore feed?"
    confirm-text="Unshare"
    confirm-color="primary"
    icon="i-lucide-eye-off"
    :loading="isTogglingShare"
    @confirm="toggleShare"
  />
</template>
