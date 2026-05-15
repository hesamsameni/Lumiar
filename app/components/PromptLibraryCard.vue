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
    class="group relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:shadow-lg transition-all"
  >
    <div class="aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
      <img
        v-if="card.image"
        :src="card.image"
        :alt="card.title"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      <div
        v-else
        :class="`w-full h-full bg-gradient-to-br ${card.category.color} flex items-center justify-center`"
      >
        <UIcon :name="card.category.icon" class="size-12 text-white/50" />
      </div>
    </div>

    <div
      class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2"
    >
      <p class="text-white/90 text-xs line-clamp-4 leading-relaxed">
        {{ card.prompt }}
      </p>
      <UButton
        size="xs"
        block
        icon="i-lucide-clipboard-copy"
        @click.stop="emit('use', card.prompt)"
      >
        Use Prompt
      </UButton>
    </div>

    <div class="p-2.5">
      <p
        class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate leading-tight"
      >
        {{ card.title }}
      </p>
    </div>
  </div>
</template>
