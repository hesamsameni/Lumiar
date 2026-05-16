<script setup lang="ts">
import { convertHeicToJpeg } from "~/utils/imageCompression";
const props = defineProps<{
  modelValue: string;
  inputFile?: File | null;
  previewUrl?: string | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:inputFile": [file: File | null];
  "update:previewUrl": [url: string | null];
  browse: [];
}>();

const supabase = useSupabaseClient();
const toast = useToast();
const isPolishing = ref(false);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("image/")) handleFile(file);
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleFile(file);
}

const isProcessingImage = ref(false);

async function handleFile(file: File) {
  isProcessingImage.value = true;
  try {
    emit("update:inputFile", file);
    
    // Convert HEIC to JPEG for the preview so the browser can render it
    const previewFile = await convertHeicToJpeg(file);
    
    const reader = new FileReader();
    reader.onload = (e) => emit("update:previewUrl", e.target?.result as string);
    reader.readAsDataURL(previewFile);
  } finally {
    isProcessingImage.value = false;
  }
}

function clearFile() {
  emit("update:inputFile", null);
  emit("update:previewUrl", null);
  if (fileInput.value) fileInput.value.value = "";
}

async function polishPrompt() {
  if (!props.modelValue.trim()) {
    toast.add({ title: "Write a prompt first", color: "warning" });
    return;
  }
  isPolishing.value = true;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const { polished } = await $fetch<{ polished: string }>(
      "/api/polish-prompt",
      {
        method: "POST",
        body: { prompt: props.modelValue },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
    );
    emit("update:modelValue", polished);
    toast.add({
      title: "Prompt polished!",
      description: "AI has enhanced your prompt.",
      color: "success",
    });
  } catch {
    toast.add({
      title: "Polish failed",
      description: "Could not improve the prompt.",
      color: "error",
    });
  } finally {
    isPolishing.value = false;
  }
}
</script>

<template>
  <div
    class="rounded-2xl border bg-white dark:bg-zinc-900 overflow-hidden transition-all"
    :class="
      isDragging
        ? 'border-primary ring-2 ring-primary/20'
        : 'border-zinc-200 dark:border-zinc-800'
    "
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="onDrop"
  >
    <!-- Attached image preview -->
    <div
      v-if="previewUrl"
      class="relative border-b border-zinc-100 dark:border-zinc-800"
    >
      <img
        :src="previewUrl"
        alt="Input image"
        class="w-full max-h-52 object-cover"
      />
      <button
        type="button"
        class="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
        @click="clearFile"
      >
        <UIcon name="i-lucide-x" class="size-3.5" />
      </button>
      <span
        class="absolute bottom-2 left-2 text-xs text-white/90 bg-black/50 rounded-lg px-2 py-0.5 backdrop-blur-sm"
      >
        Input image
      </span>
    </div>

    <!-- Textarea -->
    <textarea
      :value="modelValue"
      :disabled="disabled"
      placeholder="Describe the image you want to generate…"
      rows="5"
      class="w-full px-4 pt-4 pb-2 text-sm bg-transparent resize-none outline-none placeholder-zinc-400 dark:placeholder-zinc-500 text-zinc-900 dark:text-zinc-100"
      @input="
        emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
      "
    />

    <!-- Toolbar -->
    <div
      class="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800"
    >
      <div class="flex items-center gap-1">
        <button
          type="button"
          :disabled="disabled || isProcessingImage"
          title="Attach image (optional)"
          class="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          @click="fileInput?.click()"
        >
          <UIcon
            :name="isProcessingImage ? 'i-lucide-loader-2' : 'i-lucide-image-plus'"
            class="size-4"
            :class="isProcessingImage ? 'animate-spin' : ''"
          />
        </button>
        <button
          type="button"
          :disabled="disabled"
          title="Browse prompt library"
          class="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          @click="emit('browse')"
        >
          <UIcon name="i-lucide-library" class="size-3.5" />
          <span>Library</span>
        </button>
      </div>

      <UButton
        icon="i-lucide-wand-sparkles"
        size="xs"
        variant="soft"
        color="primary"
        :loading="isPolishing"
        :disabled="disabled || !modelValue.trim()"
        @click="polishPrompt"
      >
        Polish with AI
      </UButton>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    />
  </div>
</template>
