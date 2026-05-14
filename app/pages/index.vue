<script setup lang="ts">
import { AI_MODELS, type AIModel } from "~/utils/models";
import { ASPECT_RATIOS, GENERATION_TAGS } from "~/utils/constants";
import { useGenerationService } from "~/services/generation.service";

const route = useRoute();
const { generate, isGenerating, result } = useGeneration();
const generationService = useGenerationService();

const prompt = ref("");
const selectedModel = ref<AIModel>(AI_MODELS[0]!);
const inputFile = ref<File | null>(null);
const inputPreviewUrl = ref<string | null>(null);
const selectedAspectRatio = ref(ASPECT_RATIOS[0]!);
const selectedTags = ref<string[]>([]);
const editingImageUrl = ref<string | null>(null);

onMounted(async () => {
  const editId = route.query.edit as string | undefined;
  if (editId) {
    const { data } = await generationService.getGenerationForEdit(editId);
    if (data) {
      const row = data as { output_image_url: string; prompt: string };
      editingImageUrl.value = row.output_image_url;
      inputPreviewUrl.value = row.output_image_url;
      prompt.value = row.prompt;
    }
  }
});

async function handleGenerate() {
  await generate({
    prompt: prompt.value,
    model: selectedModel.value,
    inputImageFile: inputFile.value,
    inputImageUrl: editingImageUrl.value,
    aspectRatio: selectedAspectRatio.value.value,
    tags: selectedTags.value,
  });
}

function handleEditResult(imageUrl: string) {
  editingImageUrl.value = imageUrl;
  inputFile.value = null;
  inputPreviewUrl.value = imageUrl;
  result.value = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag);
  if (idx >= 0) selectedTags.value.splice(idx, 1);
  else selectedTags.value.push(tag);
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <div class="mb-10 text-center">
      <h1 class="text-4xl font-bold tracking-tight mb-2">Create with AI</h1>
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
            @update:model-value="editingImageUrl = null"
          />
        </UCard>

        <UCard>
          <template #header>
            <span class="font-medium text-sm">Prompt</span>
          </template>
          <PromptInput v-model="prompt" :disabled="isGenerating" />

          <div class="mt-3">
            <p class="text-xs text-zinc-400 dark:text-zinc-500 mb-2">Tags</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="tag in GENERATION_TAGS"
                :key="tag"
                class="text-xs px-2 py-1 rounded-full border transition-all"
                :class="
                  selectedTags.includes(tag)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                "
                @click="toggleTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <span class="font-medium text-sm">Aspect Ratio</span>
          </template>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="ratio in ASPECT_RATIOS"
              :key="ratio.value"
              class="px-3 py-1.5 rounded-lg border text-sm transition-all"
              :class="
                selectedAspectRatio.value === ratio.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
              "
              @click="selectedAspectRatio = ratio"
            >
              {{ ratio.label }}
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
              : `Generate · ${selectedModel.tokensPerGeneration} tokens`
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
            <span class="text-xs text-zinc-400">{{ selectedModel.name }}</span>
          </div>
          <ModelSelector v-model="selectedModel" />
        </div>
      </div>
    </div>
  </div>
</template>
