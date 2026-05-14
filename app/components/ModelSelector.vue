<script setup lang="ts">
import { AI_MODELS, TIER_CONFIG, type AIModel } from '~/utils/models'

const props = defineProps<{
  modelValue: AIModel
}>()

const emit = defineEmits<{
  'update:modelValue': [model: AIModel]
}>()

const tierColorMap: Record<string, string> = {
  amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
  blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
  green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40',
}
</script>

<template>
  <div class="grid gap-2">
    <div
      v-for="model in AI_MODELS"
      :key="model.id"
      class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
      :class="modelValue.id === model.id
        ? 'border-primary bg-primary/5 dark:bg-primary/10'
        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'"
      @click="emit('update:modelValue', model)"
    >
      <div
        class="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all"
        :class="modelValue.id === model.id
          ? 'border-primary bg-primary'
          : 'border-zinc-300 dark:border-zinc-600'"
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-medium text-sm">{{ model.name }}</span>
          <span
            class="text-xs font-medium px-1.5 py-0.5 rounded-full"
            :class="tierColorMap[TIER_CONFIG[model.tier].color]"
          >
            {{ TIER_CONFIG[model.tier].label }}
          </span>
          <span class="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">{{ model.priceEstimate }}</span>
        </div>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{{ model.description }}</p>
        <div class="flex items-center gap-3 mt-1">
          <span class="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
            <UIcon name="i-lucide-zap" class="size-3 text-amber-500" />
            {{ model.tokensPerGeneration }} tokens
          </span>
          <span v-if="model.supportsImageInput" class="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
            <UIcon name="i-lucide-image" class="size-3" />
            Image input
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
