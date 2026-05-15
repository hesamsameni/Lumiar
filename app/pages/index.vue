<script setup lang="ts">
import type { AIModel } from "~/utils/models";
import { ASPECT_RATIOS } from "~/utils/constants";
import { useGenerationService } from "~/services/generation.service";

const route = useRoute();
const { generate, isGenerating, result } = useGeneration();
const generationService = useGenerationService();
const toast = useToast();
const { models, fetchModels, firstModel } = useModels();

await fetchModels();

const prompt = ref("");
const selectedModel = ref<AIModel>(firstModel.value!);
const inputFile = ref<File | null>(null);
const inputPreviewUrl = ref<string | null>(null);
const selectedAspectRatio = ref(ASPECT_RATIOS[0]!);
const editingImageUrl = ref<string | null>(null);
const editingGenerationId = ref<string | null>(null);
const showPromptLibrary = ref(false);

onMounted(async () => {
  const editId = route.query.edit as string | undefined;
  if (editId) {
    const { data } = await generationService.getGenerationForEdit(editId);
    if (data) {
      const row = data as { output_image_url: string; prompt: string };
      editingImageUrl.value = row.output_image_url;
      inputPreviewUrl.value = row.output_image_url;
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
    (inputFile.value || editingImageUrl.value)
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
    inputImageFile: inputFile.value,
    inputImageUrl: editingImageUrl.value,
    aspectRatio: selectedAspectRatio.value.value,
    parentId: editingGenerationId.value,
  });
}

function handleEditResult(imageUrl: string, generationId: string) {
  editingImageUrl.value = imageUrl;
  editingGenerationId.value = generationId;
  inputFile.value = null;
  inputPreviewUrl.value = imageUrl;
  prompt.value = "";
  result.value = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getRatioStyle(value: string): Record<string, string> {
  if (value === "auto") return { width: "36px", height: "36px" };
  const [w, h] = value.split(":").map(Number);
  const maxSize = 36;
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
  <div class="max-w-5xl mx-auto px-4 py-10">
    <div class="mb-10 text-center">
      <h1 class="text-4xl font-bold tracking-tight mb-2">
        Create with <span class="text-primary">Lumiar</span>
      </h1>
      <p class="text-zinc-500 dark:text-zinc-400 text-lg">
        Generate and edit images using state-of-the-art models
      </p>
    </div>

    <div class="grid lg:grid-cols-[1fr_340px] gap-6">
      <div class="space-y-5">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium text-sm"
                >Input Image
                <span class="text-zinc-400 text-xs">(optional)</span></span
              >
              <span v-if="editingImageUrl" class="text-xs text-primary"
                >Editing previous generation</span
              >
            </div>
          </template>
          <ImageUploader
            v-model="inputFile"
            v-model:previewUrl="inputPreviewUrl"
            @update:model-value="
              () => {
                editingImageUrl = null;
              }
            "
          />
        </UCard>

        <UCard>
          <template #header>
            <span class="font-medium text-sm">Prompt</span>
          </template>
          <PromptInput
            v-model="prompt"
            :disabled="isGenerating"
            @browse="showPromptLibrary = true"
          />
        </UCard>

        <PromptLibrarySlideover
          :open="showPromptLibrary"
          @update:open="showPromptLibrary = $event"
          @select="prompt = $event"
        />

        <UCard>
          <template #header>
            <span class="font-medium text-sm">Aspect Ratio</span>
          </template>
          <div class="flex gap-3 flex-wrap">
            <button
              v-for="ratio in ASPECT_RATIOS"
              :key="ratio.value"
              class="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all"
              :class="
                selectedAspectRatio.value === ratio.value
                  ? 'border-primary bg-primary/8 dark:bg-primary/12'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              "
              @click="selectedAspectRatio = ratio"
            >
              <!-- Visual frame preview -->
              <div
                class="flex items-center justify-center"
                style="width: 44px; height: 44px"
              >
                <template v-if="ratio.value === 'auto'">
                  <UIcon
                    name="i-lucide-wand-sparkles"
                    class="size-5 transition-all"
                    :class="
                      selectedAspectRatio.value === 'auto'
                        ? 'text-primary'
                        : 'text-zinc-400 dark:text-zinc-500'
                    "
                  />
                </template>
                <template v-else>
                  <div
                    class="rounded-sm border-2 transition-all"
                    :class="
                      selectedAspectRatio.value === ratio.value
                        ? 'border-primary bg-primary/20'
                        : 'border-zinc-400 dark:border-zinc-500'
                    "
                    :style="getRatioStyle(ratio.value)"
                  />
                </template>
              </div>
              <span
                class="text-[11px] font-medium leading-none"
                :class="
                  selectedAspectRatio.value === ratio.value
                    ? 'text-primary'
                    : 'text-zinc-500 dark:text-zinc-400'
                "
                >{{ ratio.value === "auto" ? "Auto" : ratio.value }}</span
              >
            </button>
          </div>
        </UCard>

        <UButton
          size="xl"
          block
          icon="i-lucide-sparkles"
          :loading="isGenerating"
          :disabled="!prompt.trim()"
          @click="handleGenerate"
        >
          {{
            isGenerating
              ? "Generating…"
              : `Generate · ${selectedModel.tokens_per_generation} tokens`
          }}
        </UButton>

        <GenerationResult
          v-if="result"
          :image-url="result.imageUrl"
          :generation-id="result.generationId"
          :prompt="prompt"
          @edit="handleEditResult"
        />
      </div>

      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="font-medium text-sm">Model</span>
            <span class="text-xs text-primary-400">{{
              selectedModel.name
            }}</span>
          </div>
          <ModelSelector v-model="selectedModel" />
        </div>
      </div>
    </div>
  </div>
</template>
