<script setup lang="ts">
import { useCollectionService } from "~/services/collection.service";
import { useProfileService } from "~/services/profile.service";
import type { MediaItem } from "~/types/media.types";

const route = useRoute();
const router = useRouter();
const { user: authUser } = useAuthState();
const collectionService = useCollectionService();
const profileService = useProfileService();
const toast = useToast();

const collectionId = computed(() => route.params.id as string);

interface CollectionMeta {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  created_at: string;
}

interface GenerationItem {
  id: string;
  output_image_url: string;
  prompt: string;
  model_name: string;
  created_at: string;
  is_shared: boolean;
  metadata?: { tags?: string[] };
  likes?: { id: string }[];
}

const collection = ref<CollectionMeta | null>(null);
const items = ref<MediaItem[]>([]);
const ownerUsername = ref<string | null>(null);
const loading = ref(true);
const notFound = ref(false);
const showDeleteModal = ref(false);
const isDeletingCollection = ref(false);

const isOwner = computed(
  () => authUser.value?.id === collection.value?.user_id,
);

async function loadCollection() {
  const { data, error } = await collectionService.getCollectionById(
    collectionId.value,
  );
  if (error || !data) {
    notFound.value = true;
    loading.value = false;
    return;
  }
  collection.value = data as CollectionMeta;

  const isPublicOrOwner = data.is_public || data.user_id === authUser.value?.id;
  if (!isPublicOrOwner) {
    notFound.value = true;
    loading.value = false;
    return;
  }

  const [{ data: rows }, { data: ownerProfile }] = await Promise.all([
    collectionService.getCollectionItems(collectionId.value),
    profileService.getProfileById(data.user_id),
  ]);

  items.value = ((rows ?? []) as any[])
    .map((row): MediaItem | null => {
      if (row.generations) {
        return { ...row.generations, media_type: "image" } as MediaItem;
      }
      if (row.video_generations) {
        return { ...row.video_generations, media_type: "video" } as MediaItem;
      }
      return null;
    })
    .filter((m): m is MediaItem => m !== null);

  ownerUsername.value = (ownerProfile as any)?.username ?? null;

  loading.value = false;
}

function handleDeleted(id: string) {
  items.value = items.value.filter((g) => g.id !== id);
}

function handleShareToggled(id: string, isShared: boolean) {
  const gen = items.value.find((g) => g.id === id);
  if (gen) (gen as { is_shared?: boolean }).is_shared = isShared;
}

function handleRemovedFromCollection(id: string) {
  items.value = items.value.filter((g) => g.id !== id);
}

async function deleteCollection() {
  isDeletingCollection.value = true;
  try {
    const { error } = await collectionService.deleteCollection(
      collectionId.value,
    );
    if (error) throw error;
    toast.add({ title: "Collection deleted", color: "success" });
    if (ownerUsername.value) {
      router.push(`/profile/${ownerUsername.value}`);
    } else {
      router.push("/");
    }
  } catch {
    toast.add({ title: "Failed to delete collection", color: "error" });
    isDeletingCollection.value = false;
    showDeleteModal.value = false;
  }
}

onMounted(loadCollection);

const previewGenerationId = ref<string | null>(null);
const showPreviewModal = ref(false);
const previewVideoId = ref<string | null>(null);
const showVideoModal = ref(false);

function openPreview(id: string) {
  if (
    items.value.some(
      (m) => m.id === id && (m as MediaItem).media_type === "video",
    )
  ) {
    previewVideoId.value = id;
    showVideoModal.value = true;
    return;
  }
  previewGenerationId.value = id;
  showPreviewModal.value = true;
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <div v-else-if="notFound" class="text-center py-20">
      <UIcon
        name="i-lucide-folder-x"
        class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
      />
      <p class="text-zinc-500 dark:text-zinc-400">Collection not found</p>
      <UButton to="/" size="sm" class="mt-4" variant="outline" color="neutral">
        Go home
      </UButton>
    </div>

    <template v-else-if="collection">
      <!-- Header -->
      <div class="flex items-start gap-4 mb-8">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <NuxtLink
              v-if="ownerUsername"
              :to="`/profile/${ownerUsername}`"
              class="text-sm text-zinc-500 dark:text-zinc-400 hover:text-primary transition-colors"
            >
              {{ ownerUsername }}
            </NuxtLink>
            <UIcon
              name="i-lucide-chevron-right"
              class="size-3.5 text-zinc-400"
            />
            <span class="text-sm text-zinc-400">Collections</span>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            {{ collection.name }}
          </h1>
          <p
            v-if="collection.description"
            class="text-sm text-zinc-500 dark:text-zinc-400 mt-1"
          >
            {{ collection.description }}
          </p>
          <p class="text-sm text-zinc-400 mt-1">
            {{ items.length }}
            {{ items.length === 1 ? "item" : "items" }}
          </p>
        </div>

        <UButton
          v-if="isOwner"
          icon="i-lucide-trash-2"
          size="sm"
          color="error"
          variant="ghost"
          @click="showDeleteModal = true"
        >
          Delete collection
        </UButton>
      </div>

      <!-- Empty state -->
      <div v-if="!items.length" class="text-center py-20">
        <UIcon
          name="i-lucide-images"
          class="size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
        />
        <p class="text-zinc-500 dark:text-zinc-400">This collection is empty</p>
        <UButton v-if="isOwner" to="/" size="sm" class="mt-4">
          Create images
        </UButton>
      </div>

      <!-- Masonry grid -->
      <div v-else class="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="mb-3 break-inside-avoid"
        >
          <MediaCard
            :item="item"
            :show-author="false"
            :is-owner="isOwner"
            :masonry="true"
            :collection-id="collectionId"
            @deleted="handleDeleted"
            @share-toggled="handleShareToggled"
            @removed-from-collection="handleRemovedFromCollection"
            @preview="openPreview"
          />
        </div>
      </div>
    </template>

    <!-- Delete collection confirm -->
    <ConfirmModal
      v-model:open="showDeleteModal"
      title="Delete collection"
      description="This will delete the collection permanently. Your images will not be deleted."
      confirm-text="Delete"
      confirm-color="error"
      icon="i-lucide-trash-2"
      :loading="isDeletingCollection"
      @confirm="deleteCollection"
      @cancel="showDeleteModal = false"
    />
    <GenerationDetailModal
      v-model:open="showPreviewModal"
      :generation-id="previewGenerationId"
    />
    <VideoDetailModal
      v-model:open="showVideoModal"
      :video-id="previewVideoId"
      @deleted="handleDeleted"
    />
  </div>
</template>
