<script setup lang="ts">
import type { PromptCard } from "~/utils/promptLibrary";

defineProps<{
  card: PromptCard;
}>();

const emit = defineEmits<{
  use: [prompt: string];
}>();
</script>

<template>
  <div
    class="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all hover:shadow-md hover:-translate-y-0.5 flex flex-col"
  >
    <!-- Image / gradient top -->
    <div
      class="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0"
    >
      <img
        v-if="card.image"
        :src="card.image"
        :alt="card.title"
        class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        loading="lazy"
      />
      <div
        v-else
        class="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"
      >
        <UIcon
          :name="card.category.icon"
          class="size-10 text-zinc-300 dark:text-zinc-600"
        />
      </div>
      <!-- Category badge overlaying image bottom-right -->
      <span
        class="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-black/40 text-white/90 backdrop-blur-sm"
      >
        {{ card.category.name }}
      </span>
    </div>

    <!-- Bottom section -->
    <div class="px-3 pt-2.5 pb-3 flex flex-col gap-2 flex-1">
      <div class="flex items-start gap-2">
        <p
          class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-snug flex-1 line-clamp-2"
        >
          {{ card.title }}
        </p>
      </div>
      <p
        class="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed"
      >
        {{ card.prompt }}
      </p>
      <button
        class="mt-auto w-full text-xs py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 active:bg-primary/30 transition-colors font-medium"
        @click.stop="emit('use', card.prompt)"
      >
        Use Prompt
      </button>
    </div>
  </div>
</template>
