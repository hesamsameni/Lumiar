<script setup lang="ts">
import { useGenerationService } from "~/services/generation.service";
import { downloadImageToDevice } from "~/utils/download";

const props = defineProps<{
  imageUrl: string;
  generationId: string;
  prompt: string;
}>();

const emit = defineEmits<{
  edit: [imageUrl: string, generationId: string];
  deleted: [];
}>();

const { session } = useAuthState();
const generationService = useGenerationService();
const toast = useToast();
const isSaving = ref(false);
const isShared = ref(false);
const showCollectionPicker = ref(false);
const isSavedToCollection = ref(false);
const isDeleting = ref(false);
const showDeleteModal = ref(false);

async function deleteGeneration() {
  isDeleting.value = true;
  try {
    await $fetch(`/api/generations/${props.generationId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.value?.access_token ?? ""}` },
    });
    toast.add({ title: "Image deleted", color: "success" });
    emit("deleted");
  } catch {
    toast.add({ title: "Failed to delete image", color: "error" });
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

async function downloadImage() {
  await downloadImageToDevice(
    props.imageUrl,
    `lumiar-${props.generationId}.png`,
  );
}

async function toggleShare() {
  isSaving.value = true;
  try {
    const { error } = await generationService.setGenerationShared(
      props.generationId,
      !isShared.value,
    );
    if (error) throw error;
    isShared.value = !isShared.value;
    toast.add({
      title: isShared.value ? "Shared to Explore!" : "Removed from Explore",
      color: "success",
    });
  } catch {
    toast.add({ title: "Failed to update sharing", color: "error" });
  } finally {
    isSaving.value = false;
  }
}

onMounted(async () => {
  const { data } = await generationService.getGenerationShareState(
    props.generationId,
  );
  if (data) isShared.value = (data as { is_shared: boolean }).is_shared;
});
</script>

<template>
  <!-- Ready divider -->
  <div class="flex items-center gap-3 mb-5 mt-5">
    <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    <span
      class="flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500 select-none"
    >
      <UIcon name="i-lucide-sparkles" class="size-3 text-primary" />
      Your image is ready
    </span>
    <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
  </div>

  <!-- Result card -->
  <div
    class="rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-200/60 dark:shadow-black/40"
  >
    <!-- Image -->
    <div class="bg-zinc-100 dark:bg-zinc-950">
      <img
        :src="imageUrl"
        alt="Generated image"
        class="w-full object-contain"
      />
    </div>

    <!-- Actions panel -->
    <div class="p-5 space-y-3 border-t border-zinc-100 dark:border-zinc-800">
      <!-- Prompt -->
      <p
        class="text-xs text-zinc-500 dark:text-zinc-400 italic line-clamp-2 leading-relaxed"
        :style="rtlStyle(prompt)"
        :dir="hasRtlChars(prompt) ? 'rtl' : 'ltr'"
      >
        "{{ prompt }}"
      </p>

      <!-- Primary actions -->
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-download"
          size="sm"
          variant="solid"
          color="neutral"
          class="flex-1"
          @click="downloadImage"
        >
          Download
        </UButton>
        <UButton
          icon="i-lucide-pencil"
          size="sm"
          variant="outline"
          color="neutral"
          class="flex-1"
          @click="emit('edit', imageUrl, generationId)"
        >
          Edit
        </UButton>
      </div>

      <!-- Secondary actions -->
      <div
        class="flex items-center gap-0.5 pt-2 border-t border-zinc-100 dark:border-zinc-800"
      >
        <SocialShareMenu
          :generation-id="generationId"
          :image-url="imageUrl"
          :prompt="prompt"
          :is-shared="isShared"
          size="xs"
          @shared-to-explore="isShared = true"
        />
        <UButton
          :icon="isShared ? 'i-lucide-eye-off' : 'i-lucide-share-2'"
          size="xs"
          :variant="isShared ? 'soft' : 'ghost'"
          color="primary"
          :loading="isSaving"
          @click="toggleShare"
        >
          {{ isShared ? "Unshare" : "Explore" }}
        </UButton>
        <UButton
          :icon="
            isSavedToCollection
              ? 'i-lucide-folder-check'
              : 'i-lucide-folder-plus'
          "
          size="xs"
          :variant="isSavedToCollection ? 'soft' : 'ghost'"
          :color="isSavedToCollection ? 'primary' : 'neutral'"
          :title="isSavedToCollection ? 'In collection' : 'Save to collection'"
          @click="showCollectionPicker = true"
        />
        <UButton
          icon="i-lucide-arrow-up-right"
          size="xs"
          variant="ghost"
          color="neutral"
          title="View detail"
          :to="`/generation/${generationId}`"
        />
        <UButton
          icon="i-lucide-trash-2"
          size="xs"
          variant="ghost"
          color="error"
          :loading="isDeleting"
          title="Delete"
          class="ml-auto"
          @click="showDeleteModal = true"
        />
      </div>
    </div>
  </div>

  <CollectionPickerModal
    v-model:open="showCollectionPicker"
    v-model:is-saved="isSavedToCollection"
    :generation-id="generationId"
    :generation-image-url="imageUrl"
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
</template>
