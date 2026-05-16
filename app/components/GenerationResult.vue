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
}>();

const generationService = useGenerationService();
const toast = useToast();
const isSaving = ref(false);
const isShared = ref(false);

async function downloadImage() {
  await downloadImageToDevice(props.imageUrl, `lumiar-${props.generationId}.png`);
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
  <div
    class="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
  >
    <div class="relative group">
      <img
        :src="imageUrl"
        alt="Generated image"
        class="w-full object-contain max-h-[600px]"
      />
      <div
        class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all"
      />
    </div>

    <div class="p-4 space-y-3">
      <p
        class="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 italic"
        :style="rtlStyle(prompt)"
        :dir="hasRtlChars(prompt) ? 'rtl' : 'ltr'"
      >
        "{{ prompt }}"
      </p>

      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-download"
          size="sm"
          variant="outline"
          color="neutral"
          @click="downloadImage"
        >
          Download
        </UButton>

        <UButton
          icon="i-lucide-pencil"
          size="sm"
          variant="outline"
          color="neutral"
          @click="emit('edit', imageUrl, generationId)"
        >
          Edit this image
        </UButton>

        <UButton
          :icon="isShared ? 'i-lucide-eye-off' : 'i-lucide-share-2'"
          size="sm"
          :variant="isShared ? 'solid' : 'outline'"
          color="primary"
          :loading="isSaving"
          @click="toggleShare"
        >
          {{ isShared ? "Unshare" : "Share to Explore" }}
        </UButton>

        <UButton
          icon="i-lucide-eye"
          size="sm"
          variant="ghost"
          color="neutral"
          :to="`/generation/${generationId}`"
        >
          View detail
        </UButton>
      </div>
    </div>
  </div>
</template>
