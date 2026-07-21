<script setup lang="ts">
import type { AIModel } from "~/utils/models";
import { imageCreditsForQuality } from "~/utils/models";
import type { VideoModel } from "~/utils/videoModels";
import { videoCredits } from "~/utils/videoModels";
import { buildQualityPicker, currentOptionLabel } from "~/utils/quality";
import { ASPECT_RATIOS, VIDEO_ASPECT_RATIOS } from "~/utils/constants";
import { convertHeicToJpeg } from "~/utils/imageCompression";
import type { PickedAsset } from "~/utils/assetPicker";

const emit = defineEmits<{
  generated: [
    result: {
      generationId: string;
      imageUrl: string;
      prompt: string;
      modelName: string;
      aspectRatio: string;
    },
  ];
  videoGenerated: [];
}>();

const {
  generate: generateImage,
  isGenerating: isGeneratingImage,
  isPendingInBackground,
} = useGeneration();
const { generate: generateVideo, isGenerating: isGeneratingVideo } =
  useVideoGeneration();
const toast = useToast();
const supabase = useSupabaseClient();
const posthog = usePostHog();
const {
  fetchModels,
  firstModel: firstImageModel,
  getModelById: getImageModelById,
} = useModels();
const {
  fetchVideoModels,
  firstModel: firstVideoModel,
  getModelById: getVideoModelById,
} = useVideoModels();
const { profile } = useProfile();
const { isAuthenticated } = useAuthState();

// Non-blocking safety nets (they no-op when the catalog is already loaded).
if (!firstImageModel.value) fetchModels();
if (!firstVideoModel.value) fetchVideoModels();

type Mode = "image" | "video";
const mode = ref<Mode>("image");

const expanded = ref(false);
const prompt = ref("");
const isPolishing = ref(false);
const isDragging = ref(false);

// Shared image attachments. In video mode the first one acts as the first
// frame / reference (when the selected video model supports images).
const inputFiles = ref<File[]>([]);
const inputPreviewUrls = ref<string[]>([]);
const existingImageUrls = ref<string[]>([]);
const processingImageCount = ref(0);
const isProcessingImage = computed(() => processingImageCount.value > 0);

const showAssetPicker = ref(false);
const showPromptLibrary = ref(false);
const showModelSelector = ref(false);
const showRatioSelector = ref(false);
const showQualitySelector = ref(false);
const showDurationSelector = ref(false);
const showResolutionSelector = ref(false);

// ─── Image state ────────────────────────────────────────────────────────────
const imageModel = ref<AIModel | undefined>(firstImageModel.value);
const imageAspect = ref(ASPECT_RATIOS[0]!);
const imageQuality = ref<string>("auto");

const qualityPicker = computed(() =>
  imageModel.value
    ? buildQualityPicker(
        imageModel.value.tokens_per_generation,
        imageModel.value.quality_options,
        imageModel.value.default_quality,
      )
    : [],
);
const hasQuality = computed(() => qualityPicker.value.length > 0);
const currentQualityLabel = computed(() =>
  imageModel.value
    ? currentOptionLabel(
        imageModel.value.quality_options,
        imageModel.value.default_quality,
        imageQuality.value,
      )
    : "Auto",
);

watch(imageModel, () => {
  imageQuality.value = "auto";
});
watch(firstImageModel, (model) => {
  if (model && !imageModel.value) imageModel.value = model;
});

const defaultModelApplied = ref(false);
watch(
  () => profile.value?.default_model_id,
  (defaultModelId) => {
    if (defaultModelId && !defaultModelApplied.value) {
      const model = getImageModelById(defaultModelId);
      if (model) {
        imageModel.value = model;
        defaultModelApplied.value = true;
      }
    }
  },
  { immediate: true },
);

// ─── Video state ──────────────────────────────────────────────────────────
const videoModel = ref<VideoModel | undefined>(firstVideoModel.value);
const videoDuration = ref<number>(firstVideoModel.value?.duration_seconds ?? 5);
const videoAspect = ref(VIDEO_ASPECT_RATIOS[0]!);
const videoResolution = ref<string>("auto");

const videoAvailableRatios = computed(() => {
  const supported = videoModel.value?.supported_aspect_ratios ?? [];
  const filtered = VIDEO_ASPECT_RATIOS.filter((r) =>
    supported.includes(r.value),
  );
  return filtered.length ? filtered : VIDEO_ASPECT_RATIOS.slice(0, 3);
});
const videoAvailableDurations = computed(() => {
  const d = videoModel.value?.supported_durations ?? [];
  return d.length
    ? [...d].sort((a, b) => a - b)
    : [videoModel.value?.duration_seconds ?? 5];
});
const videoResolutionPicker = computed(() =>
  videoModel.value
    ? buildQualityPicker(
        videoModel.value.tokens_per_generation,
        videoModel.value.resolution_options,
        videoModel.value.default_resolution,
        videoDuration.value / (videoModel.value.duration_seconds || 1),
      )
    : [],
);
const hasVideoResolution = computed(() => videoResolutionPicker.value.length > 0);
const currentVideoResolutionLabel = computed(() =>
  videoModel.value
    ? currentOptionLabel(
        videoModel.value.resolution_options,
        videoModel.value.default_resolution,
        videoResolution.value,
      )
    : "Auto",
);

watch(
  firstVideoModel,
  (model) => {
    if (model && !videoModel.value) {
      videoModel.value = model;
      videoDuration.value = model.duration_seconds ?? 5;
      videoAspect.value = videoAvailableRatios.value[0] ?? VIDEO_ASPECT_RATIOS[0]!;
    }
  },
  { immediate: true },
);
watch(videoModel, (model) => {
  if (!model) return;
  if (!videoAvailableDurations.value.includes(videoDuration.value)) {
    videoDuration.value = model.duration_seconds ?? videoAvailableDurations.value[0]!;
  }
  if (
    !videoAvailableRatios.value.some((r) => r.value === videoAspect.value.value)
  ) {
    videoAspect.value = videoAvailableRatios.value[0]!;
  }
  videoResolution.value = "auto";
});
watch(mode, (m) => {
  if (m === "video" && !firstVideoModel.value) fetchVideoModels();
});

// ─── Shared derived ─────────────────────────────────────────────────────────
const isGenerating = computed(() =>
  mode.value === "image" ? isGeneratingImage.value : isGeneratingVideo.value,
);
const creditCost = computed(() => {
  if (mode.value === "image") {
    return imageModel.value
      ? imageCreditsForQuality(imageModel.value, imageQuality.value)
      : 0;
  }
  return videoModel.value
    ? videoCredits(videoModel.value, videoDuration.value, videoResolution.value)
    : 0;
});
const modelLabel = computed(() =>
  mode.value === "image"
    ? (imageModel.value?.name ?? "Model")
    : (videoModel.value?.name ?? "Model"),
);
const currentAspectLabel = computed(() => {
  if (mode.value === "image") {
    return imageAspect.value.value === "auto" ? "Auto" : imageAspect.value.value;
  }
  return videoAspect.value.value;
});

const maxImages = computed(() => {
  if (mode.value === "image") return imageModel.value?.max_image_inputs ?? 1;
  return videoModel.value?.supports_image_input ? 1 : 0;
});
const usedImageSlots = computed(
  () => inputFiles.value.length + existingImageUrls.value.length,
);
const canAddMore = computed(() => usedImageSlots.value < maxImages.value);
const remainingImageSlots = computed(() =>
  Math.max(0, maxImages.value - usedImageSlots.value),
);
const hasAttachments = computed(
  () => inputPreviewUrls.value.length > 0 || existingImageUrls.value.length > 0,
);

// ─── Generate ─────────────────────────────────────────────────────────────
function resetComposer() {
  prompt.value = "";
  inputFiles.value = [];
  inputPreviewUrls.value = [];
  existingImageUrls.value = [];
}

async function handleGenerate() {
  if (!isAuthenticated.value) {
    await navigateTo("/auth/login");
    return;
  }
  if (mode.value === "image") await handleGenerateImage();
  else await handleGenerateVideo();
}

async function handleGenerateImage() {
  const model = imageModel.value;
  if (!model) return;

  if (
    !model.supports_image_input &&
    (inputFiles.value.length > 0 || existingImageUrls.value.length > 0)
  ) {
    toast.add({
      title: "Selected model does not support image input",
      description:
        "Remove the input image or choose a model that supports image input.",
      color: "warning",
    });
    return;
  }

  const usedPrompt = prompt.value;
  const usedAspect = imageAspect.value.value;
  const res = await generateImage({
    prompt: usedPrompt,
    model,
    inputImageFiles: inputFiles.value.length > 0 ? inputFiles.value : null,
    existingImageUrls:
      existingImageUrls.value.length > 0 ? existingImageUrls.value : null,
    aspectRatio: usedAspect,
    quality: imageQuality.value,
  });

  if (res) {
    emit("generated", {
      generationId: res.generationId,
      imageUrl: res.imageUrl,
      prompt: usedPrompt,
      modelName: model.name,
      aspectRatio: usedAspect,
    });
    resetComposer();
  }
}

async function handleGenerateVideo() {
  const model = videoModel.value;
  if (!model) return;

  const usesImage = model.supports_image_input;
  const firstFrameFile = usesImage ? (inputFiles.value[0] ?? null) : null;
  const firstFrameUrl = usesImage ? (existingImageUrls.value[0] ?? null) : null;

  const res = await generateVideo({
    prompt: prompt.value,
    model,
    durationSeconds: videoDuration.value,
    resolution: videoResolution.value,
    firstFrameFile,
    firstFrameUrl,
    aspectRatio: videoAspect.value.value,
  });

  if (res) {
    emit("videoGenerated");
    resetComposer();
  }
}

// ─── Attachments ────────────────────────────────────────────────────────────
async function onAssetPickerConfirm(assets: PickedAsset[]) {
  for (const asset of assets) {
    if (usedImageSlots.value >= maxImages.value) break;
    if (asset.kind === "url") {
      if (!existingImageUrls.value.includes(asset.url)) {
        existingImageUrls.value = [...existingImageUrls.value, asset.url];
      }
    } else {
      await handleFile(asset.file);
    }
  }
}

function removeExistingImage(index: number) {
  existingImageUrls.value = existingImageUrls.value.filter(
    (_, i) => i !== index,
  );
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const dropped = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
    f.type.startsWith("image/"),
  );
  for (const file of dropped) {
    if (usedImageSlots.value < maxImages.value) handleFile(file);
  }
}

async function handleFile(file: File) {
  processingImageCount.value++;
  try {
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

async function polishPrompt() {
  if (!isAuthenticated.value) {
    await navigateTo("/auth/login");
    return;
  }
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
    posthog?.capture("prompt_polished", { surface: mode.value });
    toast.add({ title: "Prompt polished!", color: "success" });
  } catch {
    toast.add({ title: "Polish failed", color: "error" });
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

// Called by the dashboard "Add to composer" CTA.
function addImage(url: string) {
  if (!existingImageUrls.value.includes(url)) {
    if (usedImageSlots.value < maxImages.value) {
      existingImageUrls.value = [...existingImageUrls.value, url];
    } else {
      existingImageUrls.value = [url];
      inputFiles.value = [];
      inputPreviewUrls.value = [];
    }
  }
  expanded.value = true;
}

defineExpose({ addImage });
</script>

<template>
  <div class="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
    <div class="max-w-2xl mx-auto px-3 sm:px-4 pb-4">
      <div
        class="pointer-events-auto group/composer rounded-[calc(var(--radius-panel)+1px)] p-px transition-all duration-300 bg-gradient-to-br shadow-2xl shadow-black/10 dark:shadow-black/40"
        :class="
          isDragging
            ? 'from-indigo-500 via-violet-500 to-fuchsia-500 shadow-glow-brand'
            : 'from-zinc-200 via-zinc-200 to-zinc-200 dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800 focus-within:from-indigo-500/70 focus-within:via-violet-500/60 focus-within:to-fuchsia-500/70'
        "
        @dragover.prevent="isDragging = mode !== 'video' || !!videoModel?.supports_image_input"
        @dragleave="isDragging = false"
        @drop.prevent="onDrop"
      >
        <div
          class="rounded-panel bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl transition-all duration-200"
        >
          <!-- Header: mode toggle + expand/collapse -->
          <div class="flex items-center justify-between px-3 pt-2.5 pb-1">
            <div
              class="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            >
              <button
                type="button"
                :disabled="isGenerating"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                :class="
                  mode === 'image'
                    ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                "
                @click="mode = 'image'"
              >
                <UIcon name="i-lucide-image" class="size-3.5" />
                Image
              </button>
              <button
                type="button"
                :disabled="isGenerating"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                :class="
                  mode === 'video'
                    ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                "
                @click="mode = 'video'"
              >
                <UIcon name="i-lucide-video" class="size-3.5" />
                Video
              </button>
            </div>

            <button
              type="button"
              :title="expanded ? 'Collapse' : 'Expand options'"
              class="size-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              @click="expanded = !expanded"
            >
              <UIcon
                :name="
                  expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'
                "
                class="size-[18px]"
              />
            </button>
          </div>

          <!-- Pending-in-background banner (image) -->
          <div
            v-if="isPendingInBackground"
            class="flex items-center gap-2 px-4 py-2 text-xs text-blue-700 dark:text-blue-300 border-t border-zinc-100 dark:border-zinc-800"
          >
            <span
              class="size-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0"
            />
            Your image is generating in the background. It'll appear above when
            ready.
          </div>

          <!-- Attached images preview (expanded only) -->
          <div
            v-if="expanded && hasAttachments && maxImages > 0"
            class="border-t border-zinc-100 dark:border-zinc-800"
          >
            <div class="flex items-start gap-2 p-3 flex-wrap">
              <div
                v-for="(url, idx) in inputPreviewUrls"
                :key="`file-${idx}`"
                class="relative group flex-shrink-0"
              >
                <img
                  :src="url"
                  :alt="`Reference ${idx + 1}`"
                  class="size-16 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  @click="removeFile(idx)"
                >
                  <UIcon name="i-lucide-x" class="size-2.5" />
                </button>
              </div>
              <div
                v-for="(url, idx) in existingImageUrls"
                :key="`existing-${idx}`"
                class="relative group flex-shrink-0"
              >
                <img
                  :src="url"
                  :alt="`Selected ${idx + 1}`"
                  class="size-16 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  @click="removeExistingImage(idx)"
                >
                  <UIcon name="i-lucide-x" class="size-2.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Prompt row -->
          <div class="flex items-end gap-2 px-3 pt-1 pb-2">
            <textarea
              v-model="prompt"
              :disabled="isGenerating"
              :aria-label="mode === 'image' ? 'Image prompt' : 'Video prompt'"
              :placeholder="
                mode === 'image'
                  ? 'Describe the image you want to create…'
                  : 'Describe the video you want to create…'
              "
              :rows="expanded ? 3 : 1"
              class="flex-1 px-2 py-1.5 text-sm bg-transparent resize-none outline-none placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-zinc-100 leading-relaxed max-h-40"
              :style="rtlStyle(prompt)"
              :dir="hasRtlChars(prompt) ? 'rtl' : 'ltr'"
              @focus="expanded = true"
            />

            <UButton
              class="mb-0.5 flex-shrink-0 !bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 disabled:!brightness-100 disabled:shadow-none transition-all"
              size="sm"
              :loading="isGenerating"
              :disabled="!prompt.trim()"
              @click="handleGenerate"
            >
              <UIcon
                v-if="!isGenerating"
                :name="mode === 'image' ? 'i-lucide-sparkles' : 'i-lucide-clapperboard'"
                class="size-4"
              />
              <span class="hidden sm:inline">{{
                isGenerating ? "Generating…" : `${creditCost}`
              }}</span>
            </UButton>
          </div>

          <!-- Controls row (expanded only) -->
          <div
            v-if="expanded"
            class="flex items-center gap-1.5 px-3 pb-3 flex-wrap"
          >
            <!-- Model -->
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
              @click="showModelSelector = true"
            >
              <UIcon
                :name="mode === 'image' ? 'i-lucide-cpu' : 'i-lucide-clapperboard'"
                class="size-3.5 text-zinc-400"
              />
              <span
                class="text-xs font-medium text-zinc-700 dark:text-zinc-300 max-w-32 truncate"
                >{{ modelLabel }}</span
              >
            </button>
            <!-- Aspect ratio -->
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
              @click="showRatioSelector = true"
            >
              <UIcon name="i-lucide-ratio" class="size-3.5 text-zinc-400" />
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">{{
                currentAspectLabel
              }}</span>
            </button>
            <!-- Quality (image) -->
            <button
              v-if="mode === 'image' && hasQuality"
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
              @click="showQualitySelector = true"
            >
              <UIcon name="i-lucide-sparkles" class="size-3.5 text-zinc-400" />
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">{{
                currentQualityLabel
              }}</span>
            </button>
            <!-- Duration (video) -->
            <button
              v-if="mode === 'video'"
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
              @click="showDurationSelector = true"
            >
              <UIcon name="i-lucide-clock" class="size-3.5 text-zinc-400" />
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >{{ videoDuration }}s</span
              >
            </button>
            <!-- Resolution (video) -->
            <button
              v-if="mode === 'video' && hasVideoResolution"
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
              @click="showResolutionSelector = true"
            >
              <UIcon name="i-lucide-monitor" class="size-3.5 text-zinc-400" />
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">{{
                currentVideoResolutionLabel
              }}</span>
            </button>

            <div class="flex-1" />

            <!-- Attach -->
            <button
              v-if="isAuthenticated && maxImages > 0"
              type="button"
              :disabled="isGenerating || !canAddMore || isProcessingImage"
              :title="
                canAddMore
                  ? mode === 'video'
                    ? 'Add first frame'
                    : 'Attach image'
                  : `Max ${maxImages} image${maxImages > 1 ? 's' : ''} reached`
              "
              class="size-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 flex-shrink-0"
              @click="showAssetPicker = true"
            >
              <UIcon
                :name="
                  isProcessingImage
                    ? 'i-lucide-loader-2'
                    : 'i-lucide-image-plus'
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
              class="size-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 flex-shrink-0"
              @click="showPromptLibrary = true"
            >
              <UIcon name="i-lucide-library" class="size-[18px]" />
            </button>
            <!-- Polish -->
            <button
              type="button"
              :disabled="isGenerating || !prompt.trim()"
              title="Polish with AI"
              class="size-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 flex-shrink-0"
              :class="
                isPolishing
                  ? 'text-primary bg-primary/10'
                  : 'text-zinc-400 hover:text-primary hover:bg-primary/10'
              "
              @click="polishPrompt"
            >
              <UIcon
                name="i-lucide-wand-sparkles"
                class="size-[18px]"
                :class="isPolishing ? 'animate-pulse' : ''"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Aspect ratio slideover -->
    <USlideover
      :open="showRatioSelector"
      side="right"
      @update:open="showRatioSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0">
            <h2 class="font-display font-bold text-base tracking-tight">
              Aspect Ratio
            </h2>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="showRatioSelector = false"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-2">
            <!-- Image ratios -->
            <template v-if="mode === 'image'">
              <button
                v-for="ratio in ASPECT_RATIOS"
                :key="ratio.value"
                class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
                :class="
                  imageAspect.value === ratio.value
                    ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/25'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                "
                @click="
                  imageAspect = ratio;
                  showRatioSelector = false;
                "
              >
                <div
                  class="flex items-center justify-center flex-shrink-0"
                  style="width: 36px; height: 36px"
                >
                  <UIcon
                    v-if="ratio.value === 'auto'"
                    name="i-lucide-wand-sparkles"
                    class="size-5"
                    :class="
                      imageAspect.value === 'auto'
                        ? 'text-primary'
                        : 'text-zinc-400'
                    "
                  />
                  <div
                    v-else
                    class="rounded border-2 transition-all"
                    :class="
                      imageAspect.value === ratio.value
                        ? 'border-transparent bg-gradient-brand'
                        : 'border-zinc-400 dark:border-zinc-500'
                    "
                    :style="getRatioStyle(ratio.value)"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium"
                    :class="
                      imageAspect.value === ratio.value
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
              </button>
            </template>
            <!-- Video ratios -->
            <template v-else>
              <button
                v-for="ratio in videoAvailableRatios"
                :key="ratio.value"
                class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
                :class="
                  videoAspect.value === ratio.value
                    ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/25'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                "
                @click="
                  videoAspect = ratio;
                  showRatioSelector = false;
                "
              >
                <div
                  class="flex items-center justify-center flex-shrink-0"
                  style="width: 36px; height: 36px"
                >
                  <div
                    class="rounded border-2 transition-all"
                    :class="
                      videoAspect.value === ratio.value
                        ? 'border-transparent bg-gradient-brand'
                        : 'border-zinc-400 dark:border-zinc-500'
                    "
                    :style="getRatioStyle(ratio.value)"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium"
                    :class="
                      videoAspect.value === ratio.value
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
              </button>
            </template>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Quality slideover (image) -->
    <USlideover
      :open="showQualitySelector"
      side="right"
      @update:open="showQualitySelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0">
            <h2 class="font-display font-bold text-base tracking-tight">
              Quality
            </h2>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="showQualitySelector = false"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-2">
            <button
              v-for="q in qualityPicker"
              :key="q.value"
              class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
              :class="
                imageQuality === q.value
                  ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/25'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              "
              @click="
                imageQuality = q.value;
                showQualitySelector = false;
              "
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium"
                  :class="
                    imageQuality === q.value
                      ? 'text-primary'
                      : 'text-zinc-800 dark:text-zinc-200'
                  "
                >
                  {{ q.label }}
                </p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {{ q.hint ? `${q.hint} · ` : "" }}{{ q.credits }} credits
                </p>
              </div>
            </button>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Duration slideover (video) -->
    <USlideover
      :open="showDurationSelector"
      side="right"
      @update:open="showDurationSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0">
            <h2 class="font-display font-bold text-base tracking-tight">
              Clip Length
            </h2>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="showDurationSelector = false"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-2">
            <button
              v-for="d in videoAvailableDurations"
              :key="d"
              class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
              :class="
                videoDuration === d
                  ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/25'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              "
              @click="
                videoDuration = d;
                showDurationSelector = false;
              "
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium"
                  :class="
                    videoDuration === d
                      ? 'text-primary'
                      : 'text-zinc-800 dark:text-zinc-200'
                  "
                >
                  {{ d }} seconds
                </p>
                <p
                  v-if="videoModel"
                  class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5"
                >
                  {{ videoCredits(videoModel, d, videoResolution) }} credits
                </p>
              </div>
            </button>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Resolution slideover (video) -->
    <USlideover
      :open="showResolutionSelector"
      side="right"
      @update:open="showResolutionSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0">
            <h2 class="font-display font-bold text-base tracking-tight">
              Resolution
            </h2>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="showResolutionSelector = false"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-2">
            <button
              v-for="r in videoResolutionPicker"
              :key="r.value"
              class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
              :class="
                videoResolution === r.value
                  ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/25'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              "
              @click="
                videoResolution = r.value;
                showResolutionSelector = false;
              "
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium"
                  :class="
                    videoResolution === r.value
                      ? 'text-primary'
                      : 'text-zinc-800 dark:text-zinc-200'
                  "
                >
                  {{ r.label }}
                </p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {{ r.hint ? `${r.hint} · ` : "" }}{{ r.credits }} credits
                </p>
              </div>
            </button>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Model slideover -->
    <USlideover
      :open="showModelSelector"
      side="right"
      @update:open="showModelSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0">
            <h2 class="font-display font-bold text-base tracking-tight">
              {{ mode === "image" ? "Select Model" : "Select Video Model" }}
            </h2>
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
              v-if="mode === 'image' && imageModel"
              v-model="imageModel"
              :default-model-id="profile?.default_model_id"
              @update:model-value="showModelSelector = false"
            />
            <VideoModelSelector
              v-else-if="mode === 'video' && videoModel"
              v-model="videoModel"
              @update:model-value="showModelSelector = false"
            />
          </div>
        </div>
      </template>
    </USlideover>

    <PromptLibrarySlideover
      :open="showPromptLibrary"
      @update:open="showPromptLibrary = $event"
      @select="prompt = $event"
    />

    <AssetPickerModal
      v-model:open="showAssetPicker"
      mode="multi"
      :max-select="remainingImageSlots"
      :title="mode === 'video' ? 'Choose a first frame' : 'Add reference images'"
      @confirm="onAssetPickerConfirm"
    />
  </div>
</template>
