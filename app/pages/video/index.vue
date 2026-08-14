<script setup lang="ts">
import type { VideoModel } from "~/utils/videoModels";
import { videoCredits } from "~/utils/videoModels";
import { buildQualityPicker, currentOptionLabel } from "~/utils/quality";
import { VIDEO_ASPECT_RATIOS } from "~/utils/constants";
import { convertHeicToJpeg } from "~/utils/imageCompression";
import type { PickedAsset } from "~/utils/assetPicker";

const route = useRoute();
const toast = useToast();
const supabase = useSupabaseClient();
const posthog = usePostHog();
const { isAuthenticated } = useAuthState();
const { generate, isGenerating, result } = useVideoGeneration();
const { fetchVideoModels, firstModel, getModelById } = useVideoModels();

await fetchVideoModels();

const prompt = ref("");
const selectedModel = ref<VideoModel>(firstModel.value!);
const selectedDuration = ref<number>(firstModel.value?.duration_seconds ?? 5);

// Deep-link from Models (?model=...)
const queryModelId = computed(() => {
  const q = route.query.model;
  return typeof q === "string" && q ? q : null;
});
if (queryModelId.value) {
  const fromQuery = getModelById(queryModelId.value);
  if (fromQuery) {
    selectedModel.value = fromQuery;
    selectedDuration.value = fromQuery.duration_seconds;
  }
}
watch(queryModelId, (id) => {
  if (!id) return;
  const fromQuery = getModelById(id);
  if (fromQuery) selectedModel.value = fromQuery;
});
const selectedAspectRatio = ref(VIDEO_ASPECT_RATIOS[0]!);
const selectedResolution = ref<string>("auto");
// Image inputs: "frame" mode uses first (+ optional last) frame anchors;
// "reference" mode uses a style/content reference image.
type ImageSlot = "first" | "last";
type InputMode = "frame" | "reference" | "audio";
const imageMode = ref<InputMode>("frame");
const firstFrameFile = ref<File | null>(null);
const firstFramePreview = ref<string | null>(null);
const lastFrameFile = ref<File | null>(null);
const lastFramePreview = ref<string | null>(null);
const firstFrameInput = ref<HTMLInputElement | null>(null);
const lastFrameInput = ref<HTMLInputElement | null>(null);
// Already-hosted image picked per slot (bucket / past generation).
const firstFrameUrl = ref<string | null>(null);
const lastFrameUrl = ref<string | null>(null);
// Asset picker state.
const showAssetPicker = ref(false);
const pickerSlot = ref<ImageSlot>("first");
// Whether the asset picker is for frame slots or references.
const pickerTarget = ref<"frame" | "reference">("frame");

// Unified reference pool (images + videos merged).
interface ReferenceSlot {
  id: string;
  file: File | null;
  preview: string | null;
  url: string | null;
  mediaType: "image" | "video";
}
const referenceSlots = ref<ReferenceSlot[]>([]);
const referenceFileInput = ref<HTMLInputElement | null>(null);
let refIdCounter = 0;

// Audio input state.
const inputAudioFile = ref<File | null>(null);
const inputAudioName = ref<string | null>(null);
const inputAudioInput = ref<HTMLInputElement | null>(null);

const supportsImages = computed(
  () => selectedModel.value?.supports_image_input ?? false,
);
const supportsLastFrame = computed(
  () => selectedModel.value?.supports_last_frame ?? false,
);
const supportsVideoInput = computed(
  () => selectedModel.value?.supports_video_input ?? false,
);
const supportsAudioInput = computed(
  () => selectedModel.value?.supports_audio_input ?? false,
);
const maxReferences = computed(() => selectedModel.value?.max_references ?? 1);
const maxReferenceVideos = computed(
  () => selectedModel.value?.max_reference_videos ?? 0,
);
const videoRefCount = computed(
  () => referenceSlots.value.filter((s) => s.mediaType === "video").length,
);
const canAddReference = computed(
  () => referenceSlots.value.length < maxReferences.value,
);
const canAddVideo = computed(
  () =>
    supportsVideoInput.value && videoRefCount.value < maxReferenceVideos.value,
);
const acceptsVideoRefs = computed(
  () => supportsVideoInput.value && maxReferenceVideos.value > 0,
);
const referenceAccept = computed(() =>
  canAddVideo.value
    ? "image/*,video/mp4,video/webm,video/quicktime"
    : "image/*",
);
// Show the media inputs section if the model supports any media input type.
const supportsAnyMedia = computed(
  () =>
    supportsImages.value ||
    supportsVideoInput.value ||
    supportsAudioInput.value,
);
// Available input mode tabs for the current model.
const availableInputModes = computed(() => {
  const modes: { value: InputMode; label: string; icon: string }[] = [];
  if (supportsImages.value) {
    modes.push({ value: "frame", label: "Frames", icon: "i-lucide-image" });
  }
  if (supportsImages.value || supportsVideoInput.value) {
    modes.push({
      value: "reference",
      label: `Reference${maxReferences.value > 1 ? "s" : ""}`,
      icon: "i-lucide-palette",
    });
  }
  if (supportsAudioInput.value) {
    modes.push({
      value: "audio",
      label: "Audio",
      icon: "i-lucide-music",
    });
  }
  return modes;
});

const supportsAudioGeneration = computed(
  () => selectedModel.value?.supports_audio_generation ?? false,
);
const generateAudio = ref(true);

const showModelSelector = ref(false);
const showRatioSelector = ref(false);
const showDurationSelector = ref(false);
const showResolutionSelector = ref(false);
const isProcessingImage = ref(false);
const isPolishing = ref(false);

onMounted(() => {
  const prefilled = route.query.prompt as string | undefined;
  if (prefilled) prompt.value = prefilled;
});

// Only offer aspect ratios / durations the selected model actually supports.
const availableRatios = computed(() => {
  const supported = selectedModel.value?.supported_aspect_ratios ?? [];
  const filtered = VIDEO_ASPECT_RATIOS.filter((r) =>
    supported.includes(r.value),
  );
  return filtered.length ? filtered : VIDEO_ASPECT_RATIOS.slice(0, 3);
});

const availableDurations = computed(() => {
  const d = selectedModel.value?.supported_durations ?? [];
  return d.length
    ? [...d].sort((a, b) => a - b)
    : [selectedModel.value.duration_seconds];
});

// Keep duration + aspect ratio valid whenever the model changes.
watch(selectedModel, (model) => {
  if (!model) return;
  if (!availableDurations.value.includes(selectedDuration.value)) {
    selectedDuration.value =
      model.duration_seconds ?? availableDurations.value[0]!;
  }
  if (
    !availableRatios.value.some(
      (r) => r.value === selectedAspectRatio.value.value,
    )
  ) {
    selectedAspectRatio.value = availableRatios.value[0]!;
  }
  // Resolution tiers differ per model — reset to Auto.
  selectedResolution.value = "auto";
  // Input capabilities differ per model — clear any staged media and reset mode.
  clearMedia();
  // Trim references if new model has a lower cap.
  if (referenceSlots.value.length > maxReferences.value) {
    referenceSlots.value = referenceSlots.value.slice(0, maxReferences.value);
  }
  // Pick the first valid input mode for the new model.
  const modes = availableInputModes.value;
  if (modes.length && !modes.some((m) => m.value === imageMode.value)) {
    imageMode.value = modes[0]!.value;
  }
});

// Resolution tiers offered by the model (empty -> hide the control). Credits in
// the picker fold in the selected duration so the numbers match the button.
const resolutionPicker = computed(() =>
  buildQualityPicker(
    selectedModel.value.tokens_per_generation,
    selectedModel.value.resolution_options,
    selectedModel.value.default_resolution,
    selectedDuration.value / (selectedModel.value.duration_seconds || 1),
  ),
);
const hasResolution = computed(() => resolutionPicker.value.length > 0);
const currentResolutionLabel = computed(() =>
  currentOptionLabel(
    selectedModel.value.resolution_options,
    selectedModel.value.default_resolution,
    selectedResolution.value,
  ),
);

const creditCost = computed(() =>
  videoCredits(
    selectedModel.value,
    selectedDuration.value,
    selectedResolution.value,
  ),
);

const generatingAspect = computed(() => {
  const v = selectedAspectRatio.value.value;
  return v.replace(":", " / ");
});

async function handleFrameFile(slot: ImageSlot, file: File) {
  isProcessingImage.value = true;
  try {
    const previewFile = await convertHeicToJpeg(file);
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(previewFile);
    });
    if (slot === "first") {
      firstFrameFile.value = file;
      firstFramePreview.value = url;
      firstFrameUrl.value = null;
    } else {
      lastFrameFile.value = file;
      lastFramePreview.value = url;
      lastFrameUrl.value = null;
    }
  } finally {
    isProcessingImage.value = false;
  }
}

function onFrameChange(slot: ImageSlot, e: Event) {
  const selected = Array.from((e.target as HTMLInputElement).files ?? []).find(
    (f) => f.type.startsWith("image/"),
  );
  if (selected) handleFrameFile(slot, selected);
  (e.target as HTMLInputElement).value = "";
}

function removeFrame(slot: ImageSlot) {
  if (slot === "first") {
    firstFrameFile.value = null;
    firstFramePreview.value = null;
    firstFrameUrl.value = null;
  } else {
    lastFrameFile.value = null;
    lastFramePreview.value = null;
    lastFrameUrl.value = null;
  }
}

function openFramePicker(slot: ImageSlot) {
  pickerSlot.value = slot;
  pickerTarget.value = "frame";
  showAssetPicker.value = true;
}

// ── Reference pool handlers ─────────────────────────────────────────────
async function addReferenceFile(file: File) {
  if (!canAddReference.value) return;
  const isVideo = file.type.startsWith("video/");
  if (isVideo && !canAddVideo.value) return;
  isProcessingImage.value = true;
  try {
    let preview: string;
    if (isVideo) {
      preview = URL.createObjectURL(file);
    } else {
      const previewFile = await convertHeicToJpeg(file);
      preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(previewFile);
      });
    }
    referenceSlots.value = [
      ...referenceSlots.value,
      {
        id: `ref-${++refIdCounter}`,
        file,
        preview,
        url: null,
        mediaType: isVideo ? "video" : "image",
      },
    ];
  } finally {
    isProcessingImage.value = false;
  }
}

function addReferenceUrl(assetUrl: string) {
  if (!canAddReference.value) return;
  const isVideo = /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(assetUrl);
  if (isVideo && !canAddVideo.value) return;
  referenceSlots.value = [
    ...referenceSlots.value,
    {
      id: `ref-${++refIdCounter}`,
      file: null,
      preview: assetUrl,
      url: assetUrl,
      mediaType: isVideo ? "video" : "image",
    },
  ];
}

function removeReference(id: string) {
  const slot = referenceSlots.value.find((s) => s.id === id);
  if (slot?.preview && slot.mediaType === "video" && !slot.url) {
    URL.revokeObjectURL(slot.preview);
  }
  referenceSlots.value = referenceSlots.value.filter((s) => s.id !== id);
}

function onReferenceFileChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  for (const file of files) {
    if (!canAddReference.value) break;
    if (file.type.startsWith("video/") && !canAddVideo.value) continue;
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      addReferenceFile(file);
    }
  }
  (e.target as HTMLInputElement).value = "";
}

function openReferencePicker() {
  pickerTarget.value = "reference";
  showAssetPicker.value = true;
}

async function onPickerConfirm(assets: PickedAsset[]) {
  if (pickerTarget.value === "frame") {
    const asset = assets[0];
    if (!asset) return;
    const slot = pickerSlot.value;
    if (asset.kind === "file") {
      await handleFrameFile(slot, asset.file);
    } else {
      if (slot === "first") {
        firstFrameFile.value = null;
        firstFrameUrl.value = asset.url;
        firstFramePreview.value = asset.url;
      } else {
        lastFrameFile.value = null;
        lastFrameUrl.value = asset.url;
        lastFramePreview.value = asset.url;
      }
    }
    return;
  }
  // Reference picker: add all selected assets.
  for (const asset of assets) {
    if (!canAddReference.value) break;
    if (asset.kind === "file") {
      await addReferenceFile(asset.file);
    } else {
      addReferenceUrl(asset.url);
    }
  }
}

function removeAudioInput() {
  inputAudioFile.value = null;
  inputAudioName.value = null;
}

function onAudioChange(e: Event) {
  const file = Array.from((e.target as HTMLInputElement).files ?? []).find(
    (f) => f.type.startsWith("audio/"),
  );
  if (file) {
    inputAudioFile.value = file;
    inputAudioName.value = file.name;
  }
  (e.target as HTMLInputElement).value = "";
}

function clearMedia() {
  removeFrame("first");
  removeFrame("last");
  for (const s of referenceSlots.value) {
    if (s.preview && s.mediaType === "video" && !s.url) {
      URL.revokeObjectURL(s.preview);
    }
  }
  referenceSlots.value = [];
  removeAudioInput();
  imageMode.value = "frame";
}

async function handleGenerate() {
  if (!isAuthenticated.value) {
    await navigateTo("/auth/login");
    return;
  }

  const mode = imageMode.value;
  const useFrames = mode === "frame";
  const useRef = mode === "reference";
  const refFiles = useRef
    ? referenceSlots.value.filter((s) => s.file).map((s) => s.file!)
    : [];
  const refUrls = useRef
    ? referenceSlots.value.filter((s) => s.url && !s.file).map((s) => s.url!)
    : [];
  await generate({
    prompt: prompt.value,
    model: selectedModel.value,
    durationSeconds: selectedDuration.value,
    resolution: selectedResolution.value,
    firstFrameFile: useFrames ? firstFrameFile.value : null,
    lastFrameFile: useFrames ? lastFrameFile.value : null,
    firstFrameUrl: useFrames ? firstFrameUrl.value : null,
    lastFrameUrl: useFrames ? lastFrameUrl.value : null,
    referenceFiles: refFiles,
    referenceUrls: refUrls,
    inputAudioFile: mode === "audio" ? inputAudioFile.value : null,
    generateAudio: generateAudio.value,
    aspectRatio: selectedAspectRatio.value.value,
  });
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
    posthog?.capture("prompt_polished", { surface: "video" });
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

function handleStartOver() {
  prompt.value = "";
  clearMedia();
  result.value = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getRatioStyle(value: string): Record<string, string> {
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
  <div class="max-w-xl mx-auto px-4 py-16 sm:py-20 relative isolate">
    <AuroraBackdrop />

    <!-- Hero -->
    <div class="mb-10 text-center">
      <span
        class="inline-flex items-center gap-1.5 mb-4 rounded-full border border-zinc-200/80 dark:border-zinc-700/60 bg-white/60 dark:bg-zinc-900/50 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400"
      >
        <UIcon name="i-lucide-clapperboard" class="size-3 text-primary" />
        AI Video Studio
      </span>
      <h1
        class="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] mb-3"
      >
        Bring your ideas to
        <span class="text-gradient-brand animate-gradient-pan">motion</span>
      </h1>
      <p class="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
        Describe a scene and let AI generate a video clip
      </p>
      <div class="mt-5 flex justify-center">
        <UButton
          to="/studio"
          size="sm"
          icon="i-lucide-sparkles"
          class="rounded-full !bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 hover:animate-gradient-pan transition-all"
        >
          Try Studio Mode
        </UButton>
      </div>
    </div>

    <!-- Composer -->
    <div
      class="group/composer rounded-[calc(var(--radius-panel)+1px)] p-px transition-all duration-300 bg-gradient-to-br from-zinc-200 via-zinc-200 to-zinc-200 dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800 focus-within:from-indigo-500/70 focus-within:via-violet-500/60 focus-within:to-fuchsia-500/70"
    >
      <div
        class="rounded-panel bg-white dark:bg-zinc-900 transition-all duration-200"
      >
        <!-- Media inputs (frames / reference / video / audio) -->
        <div
          v-if="supportsAnyMedia"
          class="border-b border-zinc-100 dark:border-zinc-800 p-3 space-y-3"
        >
          <!-- Mode tabs -->
          <div
            class="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
          >
            <button
              v-for="opt in availableInputModes"
              :key="opt.value"
              type="button"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
              :class="
                imageMode === opt.value
                  ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              "
              @click="imageMode = opt.value"
            >
              <UIcon :name="opt.icon" class="size-3.5" />
              {{ opt.label }}
            </button>
          </div>
          <p class="text-[11px] text-zinc-400 dark:text-zinc-500 leading-snug">
            <template v-if="imageMode === 'frame'">
              {{
                supportsLastFrame
                  ? "Anchor the exact start frame and, optionally, the end frame."
                  : "The video will start from this exact frame."
              }}
            </template>
            <template v-else-if="imageMode === 'reference'">
              {{
                acceptsVideoRefs
                  ? "Add images or videos to guide the style &amp; content."
                  : "Add images to guide the style &amp; content of the video."
              }}
              <span
                v-if="maxReferences > 1"
                class="text-zinc-400 dark:text-zinc-500"
              >
                ({{ referenceSlots.length }}/{{ maxReferences }})
              </span>
            </template>
            <template v-else-if="imageMode === 'audio'">
              Upload audio for lip-sync or sound-driven generation.
            </template>
          </p>

          <!-- Frames mode: first (+ optional last) frame -->
          <div v-if="imageMode === 'frame'" class="flex flex-wrap gap-4">
            <div class="flex flex-col items-center gap-1.5">
              <div class="relative">
                <img
                  v-if="firstFramePreview"
                  :src="firstFramePreview"
                  alt="First frame"
                  class="size-20 object-cover rounded-lg border-2 border-primary/50"
                />
                <button
                  v-else-if="isAuthenticated"
                  type="button"
                  :disabled="isProcessingImage"
                  class="size-20 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:border-primary/50 hover:text-primary transition-colors"
                  @click="openFramePicker('first')"
                >
                  <UIcon name="i-lucide-plus" class="size-5" />
                </button>
                <button
                  v-if="firstFramePreview"
                  type="button"
                  class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  @click="removeFrame('first')"
                >
                  <UIcon name="i-lucide-x" class="size-2.5" />
                </button>
              </div>
              <span class="text-[11px] text-zinc-500 dark:text-zinc-400"
                >First frame</span
              >
              <input
                ref="firstFrameInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onFrameChange('first', $event)"
              />
            </div>

            <div
              v-if="supportsLastFrame"
              class="flex flex-col items-center gap-1.5"
            >
              <div class="relative">
                <img
                  v-if="lastFramePreview"
                  :src="lastFramePreview"
                  alt="Last frame"
                  class="size-20 object-cover rounded-lg border-2 border-primary/50"
                />
                <button
                  v-else-if="isAuthenticated"
                  type="button"
                  :disabled="isProcessingImage"
                  class="size-20 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:border-primary/50 hover:text-primary transition-colors"
                  @click="openFramePicker('last')"
                >
                  <UIcon name="i-lucide-plus" class="size-5" />
                </button>
                <button
                  v-if="lastFramePreview"
                  type="button"
                  class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  @click="removeFrame('last')"
                >
                  <UIcon name="i-lucide-x" class="size-2.5" />
                </button>
              </div>
              <span class="text-[11px] text-zinc-500 dark:text-zinc-400"
                >Last frame</span
              >
              <input
                ref="lastFrameInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onFrameChange('last', $event)"
              />
            </div>
          </div>

          <!-- Reference mode: multi-slot grid for images + videos -->
          <div
            v-else-if="imageMode === 'reference'"
            class="flex flex-wrap gap-3"
          >
            <div
              v-for="slot in referenceSlots"
              :key="slot.id"
              class="flex flex-col items-center gap-1.5"
            >
              <div class="relative">
                <video
                  v-if="slot.mediaType === 'video' && slot.preview"
                  :src="slot.preview"
                  class="size-20 object-cover rounded-lg border-2 border-primary/50"
                  muted
                  playsinline
                  @mouseenter="($event.target as HTMLVideoElement).play()"
                  @mouseleave="
                    ($event.target as HTMLVideoElement).pause();
                    ($event.target as HTMLVideoElement).currentTime = 0;
                  "
                />
                <img
                  v-else-if="slot.preview"
                  :src="slot.preview"
                  alt="Reference"
                  class="size-20 object-cover rounded-lg border-2 border-primary/50"
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  @click="removeReference(slot.id)"
                >
                  <UIcon name="i-lucide-x" class="size-2.5" />
                </button>
                <span
                  v-if="slot.mediaType === 'video'"
                  class="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white leading-none"
                >
                  <UIcon name="i-lucide-film" class="size-2.5" />
                </span>
              </div>
            </div>
            <div
              v-if="canAddReference && isAuthenticated"
              class="flex flex-col items-center gap-1.5"
            >
              <button
                type="button"
                :disabled="isProcessingImage"
                class="size-20 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:border-primary/50 hover:text-primary transition-colors"
                @click="openReferencePicker()"
              >
                <UIcon name="i-lucide-plus" class="size-5" />
              </button>
              <span class="text-[11px] text-zinc-500 dark:text-zinc-400">
                {{ acceptsVideoRefs ? "Image / Video" : "Image" }}
              </span>
            </div>
            <input
              ref="referenceFileInput"
              type="file"
              :accept="referenceAccept"
              multiple
              class="hidden"
              @change="onReferenceFileChange($event)"
            />
          </div>

          <!-- Audio input mode -->
          <div v-else-if="imageMode === 'audio'" class="flex flex-wrap gap-4">
            <div class="flex flex-col items-center gap-1.5">
              <div class="relative">
                <div
                  v-if="inputAudioName"
                  class="size-20 rounded-lg border-2 border-primary/50 bg-primary/5 flex flex-col items-center justify-center gap-1 px-1"
                >
                  <UIcon name="i-lucide-music" class="size-5 text-primary" />
                  <span
                    class="text-[9px] text-zinc-600 dark:text-zinc-300 truncate w-full text-center"
                    >{{ inputAudioName }}</span
                  >
                </div>
                <button
                  v-else-if="isAuthenticated"
                  type="button"
                  class="size-20 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:border-primary/50 hover:text-primary transition-colors"
                  @click="inputAudioInput?.click()"
                >
                  <UIcon name="i-lucide-music" class="size-5" />
                </button>
                <button
                  v-if="inputAudioName"
                  type="button"
                  class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  @click="removeAudioInput()"
                >
                  <UIcon name="i-lucide-x" class="size-2.5" />
                </button>
              </div>
              <span class="text-[11px] text-zinc-500 dark:text-zinc-400"
                >Audio track</span
              >
              <input
                ref="inputAudioInput"
                type="file"
                accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg"
                class="hidden"
                @change="onAudioChange($event)"
              />
            </div>
          </div>
        </div>

        <textarea
          v-model="prompt"
          :disabled="isGenerating"
          placeholder="Describe the video you want to generate…"
          rows="6"
          class="w-full px-5 pt-5 pb-3 text-sm bg-transparent resize-none outline-none placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-zinc-100 leading-relaxed rounded-t-panel"
          :style="rtlStyle(prompt)"
          :dir="hasRtlChars(prompt) ? 'rtl' : 'ltr'"
        />

        <div class="border-t border-zinc-100 dark:border-zinc-800">
          <!-- Selection summary strip (model + ratio + duration) -->
          <div
            class="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800"
          >
            <button
              type="button"
              class="flex-1 flex items-center gap-2 rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-left"
              @click="showModelSelector = true"
            >
              <UIcon
                name="i-lucide-clapperboard"
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
              class="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
              @click="showRatioSelector = true"
            >
              <UIcon name="i-lucide-ratio" class="size-3.5 text-zinc-400" />
              <span
                class="text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >{{ selectedAspectRatio.value }}</span
              >
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
              @click="showDurationSelector = true"
            >
              <UIcon name="i-lucide-clock" class="size-3.5 text-zinc-400" />
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >{{ selectedDuration }}s</span
              >
            </button>
            <button
              v-if="hasResolution"
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
              @click="showResolutionSelector = true"
            >
              <UIcon name="i-lucide-monitor" class="size-3.5 text-zinc-400" />
              <span
                class="text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >{{ currentResolutionLabel }}</span
              >
            </button>
            <button
              v-if="supportsAudioGeneration"
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-3 py-2 border flex-shrink-0 transition-colors"
              :class="
                generateAudio
                  ? 'bg-primary/10 border-primary/30 dark:border-primary/40'
                  : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700'
              "
              @click="generateAudio = !generateAudio"
            >
              <UIcon
                :name="
                  generateAudio ? 'i-lucide-volume-2' : 'i-lucide-volume-x'
                "
                class="size-3.5"
                :class="generateAudio ? 'text-primary' : 'text-zinc-400'"
              />
              <span
                class="text-xs font-medium"
                :class="
                  generateAudio
                    ? 'text-primary'
                    : 'text-zinc-700 dark:text-zinc-300'
                "
                >Audio</span
              >
            </button>
          </div>

          <div class="flex items-center gap-1.5 px-3 py-2.5">
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

            <!-- Generate -->
            <UButton
              class="ml-auto flex-shrink-0 !bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 hover:animate-gradient-pan disabled:!brightness-100 disabled:shadow-none transition-all"
              size="sm"
              :loading="isGenerating"
              :disabled="!prompt.trim()"
              @click="handleGenerate"
            >
              {{
                isGenerating
                  ? "Generating…"
                  : `Generate · ${creditCost} Credits`
              }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Ratio slideover -->
    <USlideover
      :open="showRatioSelector"
      side="right"
      @update:open="showRatioSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div
            class="relative flex items-center justify-between px-5 py-4 flex-shrink-0"
          >
            <div class="flex items-center gap-3">
              <span
                class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15"
              >
                <UIcon name="i-lucide-ratio" class="size-[18px]" />
              </span>
              <div>
                <h2 class="font-display font-bold text-base tracking-tight">
                  Aspect Ratio
                </h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Choose the video shape
                </p>
              </div>
            </div>
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
              v-for="ratio in availableRatios"
              :key="ratio.value"
              class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
              :class="
                selectedAspectRatio.value === ratio.value
                  ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/25'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              "
              @click="
                selectedAspectRatio = ratio;
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
                    selectedAspectRatio.value === ratio.value
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

    <!-- Duration slideover -->
    <USlideover
      :open="showDurationSelector"
      side="right"
      @update:open="showDurationSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div
            class="relative flex items-center justify-between px-5 py-4 flex-shrink-0"
          >
            <div class="flex items-center gap-3">
              <span
                class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15"
              >
                <UIcon name="i-lucide-clock" class="size-[18px]" />
              </span>
              <div>
                <h2 class="font-display font-bold text-base tracking-tight">
                  Clip Length
                </h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Longer clips cost more credits
                </p>
              </div>
            </div>
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
              v-for="d in availableDurations"
              :key="d"
              class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
              :class="
                selectedDuration === d
                  ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/25'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              "
              @click="
                selectedDuration = d;
                showDurationSelector = false;
              "
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium"
                  :class="
                    selectedDuration === d
                      ? 'text-primary'
                      : 'text-zinc-800 dark:text-zinc-200'
                  "
                >
                  {{ d }} seconds
                </p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {{ videoCredits(selectedModel, d, selectedResolution) }}
                  credits
                </p>
              </div>
              <UIcon
                v-if="selectedDuration === d"
                name="i-lucide-check"
                class="size-4 text-primary flex-shrink-0"
              />
            </button>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Resolution slideover -->
    <USlideover
      :open="showResolutionSelector"
      side="right"
      @update:open="showResolutionSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div
            class="relative flex items-center justify-between px-5 py-4 flex-shrink-0"
          >
            <div class="flex items-center gap-3">
              <span
                class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15"
              >
                <UIcon name="i-lucide-monitor" class="size-[18px]" />
              </span>
              <div>
                <h2 class="font-display font-bold text-base tracking-tight">
                  Resolution
                </h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Higher resolution costs more credits
                </p>
              </div>
            </div>
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
              v-for="r in resolutionPicker"
              :key="r.value"
              class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left"
              :class="
                selectedResolution === r.value
                  ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/25'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              "
              @click="
                selectedResolution = r.value;
                showResolutionSelector = false;
              "
            >
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium"
                  :class="
                    selectedResolution === r.value
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
              <UIcon
                v-if="selectedResolution === r.value"
                name="i-lucide-check"
                class="size-4 text-primary flex-shrink-0"
              />
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
          <div
            class="relative flex items-center justify-between px-5 py-4 flex-shrink-0"
          >
            <div class="flex items-center gap-3">
              <span
                class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15"
              >
                <UIcon name="i-lucide-clapperboard" class="size-[18px]" />
              </span>
              <div>
                <h2 class="font-display font-bold text-base tracking-tight">
                  Select Video Model
                </h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {{ selectedModel.name }} · {{ selectedDuration }}s ·
                  {{ creditCost }} credits
                </p>
              </div>
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
            <VideoModelSelector
              v-model="selectedModel"
              @update:model-value="showModelSelector = false"
            />
          </div>
        </div>
      </template>
    </USlideover>

    <AssetPickerModal
      v-model:open="showAssetPicker"
      :mode="
        pickerTarget === 'reference' && maxReferences > 1 ? 'multi' : 'single'
      "
      :max-select="
        pickerTarget === 'reference' ? maxReferences - referenceSlots.length : 1
      "
      :title="
        pickerTarget === 'reference' ? 'Choose references' : 'Choose an image'
      "
      :accept="pickerTarget === 'reference' ? referenceAccept : 'image/*'"
      @confirm="onPickerConfirm"
    />

    <!-- Generating state (matches image generation style) -->
    <div v-if="isGenerating" class="mt-12">
      <div class="flex items-center gap-3 mb-5">
        <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        <span
          class="flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500 select-none"
        >
          <UIcon name="i-lucide-loader-2" class="size-3 animate-spin" />
          Creating your video
        </span>
        <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div
        class="relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
        :style="{ aspectRatio: generatingAspect }"
      >
        <!-- Animated brand gradient wash -->
        <div
          class="absolute inset-0 bg-gradient-brand opacity-20 animate-gradient-pan"
        />
        <div class="absolute inset-0 bg-grain opacity-10 mix-blend-overlay" />
        <!-- Center content -->
        <div
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6"
        >
          <span
            class="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur shadow-glow-brand"
          >
            <UIcon
              name="i-lucide-sparkles"
              class="size-6 text-primary animate-pulse"
            />
          </span>
          <p class="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Generating your video…
          </p>
          <p
            v-if="prompt.trim()"
            class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 max-w-xs"
            :style="rtlStyle(prompt)"
            :dir="hasRtlChars(prompt) ? 'rtl' : 'ltr'"
          >
            "{{ prompt }}"
          </p>
        </div>
      </div>
    </div>

    <VideoResult
      v-if="result"
      class="mt-12"
      :video-url="result.videoUrl"
      :thumbnail-url="result.thumbnailUrl"
      :generation-id="result.generationId"
      :prompt="prompt"
      @deleted="result = null"
      @start-over="handleStartOver"
    />
  </div>
</template>
