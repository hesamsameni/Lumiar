<script setup lang="ts">
import type { AIModel } from "~/utils/models";
import { ASPECT_RATIOS } from "~/utils/constants";
import { useGenerationService } from "~/services/generation.service";
import { useProfileService } from "~/services/profile.service";
import { convertHeicToJpeg } from "~/utils/imageCompression";

const route = useRoute();
const { generate, isGenerating, result } = useGeneration();
const generationService = useGenerationService();
const toast = useToast();
const { fetchModels, firstModel, getModelById } = useModels();
const { profile } = useProfile();
const profileService = useProfileService();
const supabase = useSupabaseClient();

await fetchModels();

const prompt = ref("");
const selectedModel = ref<AIModel>(firstModel.value!);
const inputFiles = ref<File[]>([]);
const inputPreviewUrls = ref<string[]>([]);
const selectedAspectRatio = ref(ASPECT_RATIOS[0]!);
const editingImageUrl = ref<string | null>(null);
const editingGenerationId = ref<string | null>(null);
const showPromptLibrary = ref(false);
const showModelSelector = ref(false);
const showRatioSelector = ref(false);

const defaultModelApplied = ref(false);
watch(
  () => profile.value?.default_model_id,
  (defaultModelId) => {
    if (defaultModelId && !defaultModelApplied.value) {
      const model = getModelById(defaultModelId);
      if (model) {
        selectedModel.value = model;
        defaultModelApplied.value = true;
      }
    }
  },
  { immediate: true },
);

async function handleSetDefault(modelId: string | null) {
  if (!profile.value?.id) return;
  const { error } = await profileService.setDefaultModel(
    profile.value.id,
    modelId,
  );
  if (error) {
    toast.add({ title: "Failed to save default model", color: "error" });
    return;
  }
  if (profile.value) profile.value.default_model_id = modelId;
  toast.add({
    title: modelId ? "Default model saved" : "Default model cleared",
    color: "success",
  });
}

const maxImages = computed(() => selectedModel.value.max_image_inputs ?? 1);
const canAddMore = computed(() => {
  const editingSlots = editingImageUrl.value ? 1 : 0;
  return inputFiles.value.length + editingSlots < maxImages.value;
});

// Composer state
const isPolishing = ref(false);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  const editId = route.query.edit as string | undefined;
  if (editId) {
    const { data } = await generationService.getGenerationForEdit(editId);
    if (data) {
      const row = data as { output_image_url: string; prompt: string };
      editingImageUrl.value = row.output_image_url;
      editingGenerationId.value = editId;
      prompt.value = "";
    }
  }
  const prefilledPrompt = route.query.prompt as string | undefined;
  if (prefilledPrompt) {
    prompt.value = prefilledPrompt;
  }
});

async function handleGenerate() {
  if (
    !selectedModel.value.supports_image_input &&
    (inputFiles.value.length > 0 || editingImageUrl.value)
  ) {
    toast.add({
      title: "Selected model does not support image input",
      description:
        "Remove the input image or choose a model that supports image input.",
      color: "warning",
    });
    return;
  }

  await generate({
    prompt: prompt.value,
    model: selectedModel.value,
    inputImageFiles: inputFiles.value.length > 0 ? inputFiles.value : null,
    inputImageUrl: editingImageUrl.value,
    aspectRatio: selectedAspectRatio.value.value,
    parentId: editingGenerationId.value,
  });
}

function handleEditResult(imageUrl: string, generationId: string) {
  editingImageUrl.value = imageUrl;
  editingGenerationId.value = generationId;
  inputFiles.value = [];
  inputPreviewUrls.value = [];
  prompt.value = "";
  result.value = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const dropped = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
    f.type.startsWith("image/"),
  );
  for (const file of dropped) {
    if (inputFiles.value.length < maxImages.value) handleFile(file);
  }
}

function onFileChange(e: Event) {
  const selected = Array.from(
    (e.target as HTMLInputElement).files ?? [],
  ).filter((f) => f.type.startsWith("image/"));
  for (const file of selected) {
    if (inputFiles.value.length < maxImages.value) handleFile(file);
  }
  // Reset so the same file can be re-selected
  (e.target as HTMLInputElement).value = "";
}

const processingImageCount = ref(0);
const isProcessingImage = computed(() => processingImageCount.value > 0);

async function handleFile(file: File) {
  processingImageCount.value++;

  try {
    // Convert HEIC to JPEG for the preview so the browser can render it
    const previewFile = await convertHeicToJpeg(file);

    inputFiles.value = [...inputFiles.value, file];
    const reader = new FileReader();
    reader.onload = (ev) => {
      inputPreviewUrls.value = [
        ...inputPreviewUrls.value,
        ev.target?.result as string,
      ];
    };
    reader.readAsDataURL(previewFile);
  } finally {
    processingImageCount.value--;
  }
}

function removeFile(index: number) {
  inputFiles.value = inputFiles.value.filter((_, i) => i !== index);
  inputPreviewUrls.value = inputPreviewUrls.value.filter((_, i) => i !== index);
}

function clearAll() {
  inputFiles.value = [];
  inputPreviewUrls.value = [];
  editingImageUrl.value = null;
  editingGenerationId.value = null;
  if (fileInput.value) fileInput.value.value = "";
}

function clearEditingImage() {
  editingImageUrl.value = null;
  editingGenerationId.value = null;
}

async function polishPrompt() {
  if (!prompt.value.trim()) {
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
        body: { prompt: prompt.value },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
    );
    prompt.value = polished;
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

function getRatioStyle(value: string): Record<string, string> {
  if (value === "auto") return { width: "28px", height: "28px" };
  const [w, h] = value.split(":").map(Number);
  const maxSize = 28;
  const aspect = (w ?? 1) / (h ?? 1);
  let width: number, height: number;
  if (aspect >= 1) {
    width = maxSize;
    height = Math.round(maxSize / aspect);
  } else {
    height = maxSize;
    width = Math.round(maxSize * aspect);
  }
  return { width: `${width}px`, height: `${height}px` };
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-16 relative isolate">
    <!-- Indigo glow backdrop -->
    <div
      class="pointer-events-none absolute inset-x-0 top-10 -z-10 flex justify-center overflow-visible"
      aria-hidden="true"
    >
      <div
        class="w-[600px] h-[400px] rounded-full bg-indigo-400/25 dark:bg-indigo-500/20 blur-[120px]"
      />
    </div>
    <!-- Hero -->
    <div class="mb-10 text-center">
      <h1 class="text-3xl font-semibold tracking-tight mb-1.5">
        What will you create?
      </h1>
      <p class="text-sm text-zinc-400 dark:text-zinc-500">
        Describe an image and let AI bring it to life
      </p>
    </div>

    <!-- Composer card -->
    <div
      class="rounded-3xl border shadow-sm bg-white dark:bg-zinc-900 transition-all duration-200"
      :class="
        isDragging
          ? 'border-primary ring-2 ring-primary/20 shadow-primary/10'
          : 'border-zinc-200 dark:border-zinc-800'
      "
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <!-- Attached images preview -->
      <div
        v-if="inputPreviewUrls.length > 0 || editingImageUrl"
        class="border-b border-zinc-100 dark:border-zinc-800"
      >
        <div class="flex items-start gap-2 p-3 flex-wrap">
          <!-- Editing image thumbnail -->
          <div v-if="editingImageUrl" class="relative group flex-shrink-0">
            <img
              :src="editingImageUrl"
              alt="Editing image"
              class="size-20 object-cover rounded-lg border-2 border-primary/50"
            />
            <button
              type="button"
              class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
              @click="clearEditingImage"
            >
              <UIcon name="i-lucide-x" class="size-2.5" />
            </button>
            <div
              class="absolute bottom-0 left-0 right-0 bg-primary/70 rounded-b-md py-0.5 flex items-center justify-center gap-1 pointer-events-none"
            >
              <UIcon name="i-lucide-pencil" class="size-2.5 text-white" />
              <span class="text-[9px] text-white font-medium">Source</span>
            </div>
          </div>

          <!-- Uploaded file thumbnails -->
          <div
            v-for="(url, idx) in inputPreviewUrls"
            :key="idx"
            class="relative group flex-shrink-0"
          >
            <img
              :src="url"
              :alt="`Reference image ${idx + 1}`"
              class="size-20 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
            />
            <button
              type="button"
              class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
              @click="removeFile(idx)"
            >
              <UIcon name="i-lucide-x" class="size-2.5" />
            </button>
          </div>

          <!-- Add more slot -->
          <button
            v-if="canAddMore"
            type="button"
            :disabled="isProcessingImage"
            class="size-20 flex-shrink-0 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            @click="fileInput?.click()"
          >
            <UIcon
              :name="isProcessingImage ? 'i-lucide-loader-2' : 'i-lucide-plus'"
              class="size-5 mb-0.5"
              :class="isProcessingImage ? 'animate-spin' : ''"
            />
            <span class="text-[10px] font-medium">{{
              isProcessingImage ? "Loading..." : "Add"
            }}</span>
          </button>
        </div>
      </div>

      <!-- Textarea -->
      <textarea
        v-model="prompt"
        :disabled="isGenerating"
        placeholder="Describe the image you want to generate…"
        rows="6"
        class="w-full px-5 pt-5 pb-3 text-sm bg-transparent resize-none outline-none placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-zinc-100 leading-relaxed rounded-t-3xl"
        :style="rtlStyle(prompt)"
        :dir="hasRtlChars(prompt) ? 'rtl' : 'ltr'"
      />

      <!-- Bottom controls -->
      <div class="border-t border-zinc-100 dark:border-zinc-800">
        <!-- Mobile-only selection summary strip -->
        <div
          class="flex sm:hidden items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800"
        >
          <button
            type="button"
            class="flex-1 flex items-center gap-2 rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-left transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
            @click="showModelSelector = true"
          >
            <UIcon
              name="i-lucide-cpu"
              class="size-3.5 text-zinc-400 flex-shrink-0"
            />
            <span
              class="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate flex-1"
              >{{ selectedModel.name }}</span
            >
            <span
              class="text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
              :class="{
                'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400':
                  selectedModel.tier === 'high',
                'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400':
                  selectedModel.tier === 'mid',
                'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400':
                  selectedModel.tier === 'low',
              }"
              >{{ selectedModel.tier }}</span
            >
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600 flex-shrink-0"
            @click="showRatioSelector = true"
          >
            <UIcon name="i-lucide-ratio" class="size-3.5 text-zinc-400" />
            <span
              class="text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >{{
                selectedAspectRatio.value === "auto"
                  ? "Auto"
                  : selectedAspectRatio.value
              }}</span
            >
          </button>
        </div>

        <div class="flex items-center gap-1.5 px-3 py-2.5">
          <!-- Attach image -->
          <button
            type="button"
            :disabled="isGenerating || !canAddMore || isProcessingImage"
            :title="
              canAddMore
                ? 'Attach image'
                : `Max ${maxImages} image${maxImages > 1 ? 's' : ''} reached`
            "
            class="size-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 flex-shrink-0"
            @click="fileInput?.click()"
          >
            <UIcon
              :name="
                isProcessingImage ? 'i-lucide-loader-2' : 'i-lucide-image-plus'
              "
              class="size-[18px]"
              :class="isProcessingImage ? 'animate-spin' : ''"
            />
          </button>

          <!-- Prompt library -->
          <button
            type="button"
            :disabled="isGenerating"
            title="Prompt library"
            class="size-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 flex-shrink-0"
            @click="showPromptLibrary = true"
          >
            <UIcon name="i-lucide-library" class="size-[18px]" />
          </button>

          <!-- Polish with AI -->
          <button
            type="button"
            :disabled="isGenerating || !prompt.trim()"
            title="Polish with AI"
            class="size-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 flex-shrink-0"
            :class="
              isPolishing
                ? 'text-primary bg-primary/10'
                : 'text-zinc-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/10'
            "
            @click="polishPrompt"
          >
            <UIcon
              name="i-lucide-wand-sparkles"
              class="size-[18px]"
              :class="isPolishing ? 'animate-pulse' : ''"
            />
          </button>

          <!-- Divider (desktop only) -->
          <div
            class="hidden sm:block w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5 flex-shrink-0"
          />

          <!-- Aspect ratio trigger (desktop only) -->
          <button
            type="button"
            :disabled="isGenerating"
            class="hidden sm:flex h-9 px-2.5 rounded-xl items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0"
            @click="showRatioSelector = true"
          >
            <UIcon name="i-lucide-ratio" class="size-3.5 flex-shrink-0" />
            <span class="hidden sm:inline">{{
              selectedAspectRatio.value === "auto"
                ? "Auto"
                : selectedAspectRatio.value
            }}</span>
          </button>

          <!-- Model trigger (desktop only) -->
          <button
            type="button"
            :disabled="isGenerating"
            class="hidden sm:flex h-9 px-2.5 rounded-xl items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0 min-w-0"
            @click="showModelSelector = true"
          >
            <UIcon name="i-lucide-cpu" class="size-3.5 flex-shrink-0" />
            <span class="hidden sm:inline">{{ selectedModel.name }}</span>
            <span
              class="text-[10px] px-1 py-0.5 rounded font-medium flex-shrink-0"
              :class="{
                'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400':
                  selectedModel.tier === 'high',
                'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400':
                  selectedModel.tier === 'mid',
                'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400':
                  selectedModel.tier === 'low',
              }"
              >{{ selectedModel.tier }}</span
            >
          </button>

          <!-- Generate -->
          <UButton
            class="ml-auto flex-shrink-0"
            size="sm"
            icon="i-lucide-sparkles"
            :loading="isGenerating"
            :disabled="!prompt.trim()"
            @click="handleGenerate"
          >
            {{
              isGenerating
                ? "Generating…"
                : `Generate · ${selectedModel.tokens_per_generation}`
            }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Ratio sidebar -->
    <USlideover
      :open="showRatioSelector"
      side="right"
      @update:open="showRatioSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0"
          >
            <h2 class="font-semibold text-base">Aspect Ratio</h2>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="showRatioSelector = false"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-2">
            <button
              v-for="ratio in ASPECT_RATIOS"
              :key="ratio.value"
              class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
              :class="
                selectedAspectRatio.value === ratio.value
                  ? 'border-primary bg-primary/8 dark:bg-primary/12'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              "
              @click="
                selectedAspectRatio = ratio;
                showRatioSelector = false;
              "
            >
              <!-- Visual preview -->
              <div
                class="flex items-center justify-center flex-shrink-0"
                style="width: 36px; height: 36px"
              >
                <template v-if="ratio.value === 'auto'">
                  <UIcon
                    name="i-lucide-wand-sparkles"
                    class="size-5"
                    :class="
                      selectedAspectRatio.value === 'auto'
                        ? 'text-primary'
                        : 'text-zinc-400'
                    "
                  />
                </template>
                <template v-else>
                  <div
                    class="rounded border-2 transition-all"
                    :class="
                      selectedAspectRatio.value === ratio.value
                        ? 'border-primary bg-primary/20'
                        : 'border-zinc-400 dark:border-zinc-500'
                    "
                    :style="getRatioStyle(ratio.value)"
                  />
                </template>
              </div>
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium"
                  :class="
                    selectedAspectRatio.value === ratio.value
                      ? 'text-primary'
                      : 'text-zinc-800 dark:text-zinc-200'
                  "
                >
                  {{ ratio.label }}
                </p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {{ ratio.width }} × {{ ratio.height }}px
                </p>
              </div>
              <UIcon
                v-if="selectedAspectRatio.value === ratio.value"
                name="i-lucide-check"
                class="size-4 text-primary flex-shrink-0"
              />
            </button>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Model sidebar -->
    <USlideover
      :open="showModelSelector"
      side="right"
      @update:open="showModelSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0"
          >
            <div>
              <h2 class="font-semibold text-base">Select Model</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {{ selectedModel.name }} ·
                {{ selectedModel.tokens_per_generation }} tokens
              </p>
            </div>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="showModelSelector = false"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <ModelSelector
              v-model="selectedModel"
              :default-model-id="profile?.default_model_id"
              @update:model-value="showModelSelector = false"
              @set-default="handleSetDefault"
            />
          </div>
        </div>
      </template>
    </USlideover>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      :multiple="maxImages > 1"
      class="hidden"
      @change="onFileChange"
    />

    <PromptLibrarySlideover
      :open="showPromptLibrary"
      @update:open="showPromptLibrary = $event"
      @select="prompt = $event"
    />

    <GenerationResult
      v-if="result"
      class="mt-12"
      :image-url="result.imageUrl"
      :generation-id="result.generationId"
      :prompt="prompt"
      @edit="handleEditResult"
      @deleted="result = null"
    />
  </div>
</template>
