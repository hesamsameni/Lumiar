<script setup lang="ts">
import type { VideoModel } from "~/utils/videoModels";
import { videoCreditsForDuration } from "~/utils/videoModels";
import { VIDEO_ASPECT_RATIOS } from "~/utils/constants";
import { convertHeicToJpeg } from "~/utils/imageCompression";

const route = useRoute();
const toast = useToast();
const { generate, isGenerating, result } = useVideoGeneration();
const { fetchVideoModels, firstModel } = useVideoModels();

await fetchVideoModels();

const prompt = ref("");
const selectedModel = ref<VideoModel>(firstModel.value!);
const selectedDuration = ref<number>(firstModel.value?.duration_seconds ?? 5);
const selectedAspectRatio = ref(VIDEO_ASPECT_RATIOS[0]!);
const inputFile = ref<File | null>(null);
const inputPreviewUrl = ref<string | null>(null);
// How an attached image is used: "frame" = first frame, "reference" = style guide.
const imageMode = ref<"frame" | "reference">("frame");
const showModelSelector = ref(false);
const showRatioSelector = ref(false);
const showDurationSelector = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const isProcessingImage = ref(false);

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
  return d.length ? [...d].sort((a, b) => a - b) : [selectedModel.value.duration_seconds];
});

// Keep duration + aspect ratio valid whenever the model changes.
watch(selectedModel, (model) => {
  if (!model) return;
  if (!availableDurations.value.includes(selectedDuration.value)) {
    selectedDuration.value =
      model.duration_seconds ?? availableDurations.value[0]!;
  }
  if (!availableRatios.value.some((r) => r.value === selectedAspectRatio.value.value)) {
    selectedAspectRatio.value = availableRatios.value[0]!;
  }
});

const creditCost = computed(() =>
  videoCreditsForDuration(selectedModel.value, selectedDuration.value),
);

const generatingAspect = computed(() => {
  const v = selectedAspectRatio.value.value;
  return v.replace(":", " / ");
});

async function handleFile(file: File) {
  isProcessingImage.value = true;
  try {
    const previewFile = await convertHeicToJpeg(file);
    inputFile.value = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      inputPreviewUrl.value = ev.target?.result as string;
    };
    reader.readAsDataURL(previewFile);
  } finally {
    isProcessingImage.value = false;
  }
}

function onFileChange(e: Event) {
  const selected = Array.from((e.target as HTMLInputElement).files ?? []).find(
    (f) => f.type.startsWith("image/"),
  );
  if (selected) handleFile(selected);
  (e.target as HTMLInputElement).value = "";
}

function removeInputImage() {
  inputFile.value = null;
  inputPreviewUrl.value = null;
  imageMode.value = "frame";
}

async function handleGenerate() {
  if (!selectedModel.value.supports_image_input && inputFile.value) {
    toast.add({
      title: "Selected model does not support image input",
      description:
        "Remove the reference image or choose a model that supports it.",
      color: "warning",
    });
    return;
  }
  await generate({
    prompt: prompt.value,
    model: selectedModel.value,
    durationSeconds: selectedDuration.value,
    inputImageFiles: inputFile.value ? [inputFile.value] : null,
    imageMode: imageMode.value,
    aspectRatio: selectedAspectRatio.value.value,
  });
}

function handleStartOver() {
  prompt.value = "";
  removeInputImage();
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
    </div>

    <!-- Composer -->
    <div
      class="group/composer rounded-[calc(var(--radius-panel)+1px)] p-px transition-all duration-300 bg-gradient-to-br from-zinc-200 via-zinc-200 to-zinc-200 dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800 focus-within:from-indigo-500/70 focus-within:via-violet-500/60 focus-within:to-fuchsia-500/70"
    >
      <div class="rounded-panel bg-white dark:bg-zinc-900 transition-all duration-200">
        <!-- Reference image preview -->
        <div
          v-if="inputPreviewUrl"
          class="border-b border-zinc-100 dark:border-zinc-800"
        >
          <div class="flex items-start gap-3 p-3">
            <div class="relative group flex-shrink-0">
              <img
                :src="inputPreviewUrl"
                alt="Input image"
                class="size-20 object-cover rounded-lg border-2 border-primary/50"
              />
              <button
                type="button"
                class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                @click="removeInputImage"
              >
                <UIcon name="i-lucide-x" class="size-2.5" />
              </button>
            </div>

            <!-- How the image should be used -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Use this image as
              </p>
              <div
                class="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              >
                <button
                  v-for="opt in [
                    { value: 'frame', label: 'Start frame', icon: 'i-lucide-image' },
                    { value: 'reference', label: 'Reference', icon: 'i-lucide-palette' },
                  ]"
                  :key="opt.value"
                  type="button"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  :class="
                    imageMode === opt.value
                      ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  "
                  @click="imageMode = opt.value as 'frame' | 'reference'"
                >
                  <UIcon :name="opt.icon" class="size-3.5" />
                  {{ opt.label }}
                </button>
              </div>
              <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-snug">
                {{
                  imageMode === "frame"
                    ? "The video will start from this exact image."
                    : "The style & content guide the video, not an exact frame."
                }}
              </p>
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
          <!-- Mobile summary strip -->
          <div
            class="flex sm:hidden items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800"
          >
            <button
              type="button"
              class="flex-1 flex items-center gap-2 rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-left"
              @click="showModelSelector = true"
            >
              <UIcon name="i-lucide-clapperboard" class="size-3.5 text-zinc-400 flex-shrink-0" />
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate flex-1">{{
                selectedModel.name
              }}</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
              @click="showRatioSelector = true"
            >
              <UIcon name="i-lucide-ratio" class="size-3.5 text-zinc-400" />
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">{{
                selectedAspectRatio.value
              }}</span>
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
          </div>

          <div class="flex items-center gap-1.5 px-3 py-2.5">
            <!-- Attach reference image -->
            <button
              type="button"
              :disabled="isGenerating || isProcessingImage"
              title="Add a start frame image"
              class="size-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 flex-shrink-0"
              @click="fileInput?.click()"
            >
              <UIcon
                :name="isProcessingImage ? 'i-lucide-loader-2' : 'i-lucide-image-plus'"
                class="size-[18px]"
                :class="isProcessingImage ? 'animate-spin' : ''"
              />
            </button>

            <div
              class="hidden sm:block w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5 flex-shrink-0"
            />

            <!-- Aspect ratio (desktop) -->
            <button
              type="button"
              :disabled="isGenerating"
              class="hidden sm:flex h-9 px-2.5 rounded-xl items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0"
              @click="showRatioSelector = true"
            >
              <UIcon name="i-lucide-ratio" class="size-3.5 flex-shrink-0" />
              <span>{{ selectedAspectRatio.value }}</span>
            </button>

            <!-- Duration (desktop) -->
            <button
              type="button"
              :disabled="isGenerating"
              class="hidden sm:flex h-9 px-2.5 rounded-xl items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0"
              @click="showDurationSelector = true"
            >
              <UIcon name="i-lucide-clock" class="size-3.5 flex-shrink-0" />
              <span>{{ selectedDuration }}s</span>
            </button>

            <!-- Model (desktop) -->
            <button
              type="button"
              :disabled="isGenerating"
              class="hidden sm:flex h-9 px-2.5 rounded-xl items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0 min-w-0"
              @click="showModelSelector = true"
            >
              <UIcon name="i-lucide-clapperboard" class="size-3.5 flex-shrink-0" />
              <span>{{ selectedModel.name }}</span>
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
                isGenerating ? "Generating…" : `Generate · ${creditCost} Credits`
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
          <div class="relative flex items-center justify-between px-5 py-4 flex-shrink-0">
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
          <div class="relative flex items-center justify-between px-5 py-4 flex-shrink-0">
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
                  {{ videoCreditsForDuration(selectedModel, d) }} credits
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

    <!-- Model slideover -->
    <USlideover
      :open="showModelSelector"
      side="right"
      @update:open="showModelSelector = $event"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div class="relative flex items-center justify-between px-5 py-4 flex-shrink-0">
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

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    />

    <!-- Generating state -->
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
        <div class="absolute inset-0 bg-gradient-brand opacity-20 animate-gradient-pan" />
        <div class="absolute inset-0 bg-grain opacity-10 mix-blend-overlay" />
        <div
          class="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
          <span
            class="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur shadow-glow-brand"
          >
            <UIcon name="i-lucide-clapperboard" class="size-6 text-primary animate-pulse" />
          </span>
          <p class="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Generating your video…
          </p>
          <p
            v-if="prompt.trim()"
            class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 max-w-xs"
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
