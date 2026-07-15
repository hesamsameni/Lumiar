<script setup lang="ts">
import type { MediaType } from "~/types/media.types";

type FilterValue = "all" | MediaType;

defineProps<{
  modelValue: FilterValue;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: FilterValue];
}>();

const options: { value: FilterValue; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "i-lucide-layout-grid" },
  { value: "image", label: "Images", icon: "i-lucide-image" },
  { value: "video", label: "Videos", icon: "i-lucide-video" },
];
</script>

<template>
  <div
    class="inline-flex items-center gap-0.5 p-1 rounded-full bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
      :class="
        modelValue === opt.value
          ? 'bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
      "
      @click="emit('update:modelValue', opt.value)"
    >
      <UIcon
        :name="opt.icon"
        class="size-3.5"
        :class="modelValue === opt.value ? 'text-primary' : ''"
      />
      <span :class="modelValue === opt.value ? 'text-gradient-brand' : ''">{{
        opt.label
      }}</span>
    </button>
  </div>
</template>
