<script setup lang="ts">
import type { PromptCard } from "~/utils/promptLibrary";

const customizingCard = ref<PromptCard | null>(null);

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  select: [prompt: string];
}>();

const { categories, promptCards, fetchLibrary } = usePromptLibrary();

watch(
  () => props.open,
  (val) => {
    if (val) fetchLibrary();
  },
  { immediate: true },
);

const search = ref("");

const filteredCards = computed(() => {
  let list = promptCards.value;
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q),
    );
  }
  return list;
});

const groupedByCategory = computed(() => {
  const groups = new Map<
    string,
    { category: (typeof categories.value)[0]; cards: typeof promptCards.value }
  >();

  for (const card of filteredCards.value) {
    const catId = card.category.id;
    if (!groups.has(catId)) {
      groups.set(catId, { category: card.category, cards: [] });
    }
    groups.get(catId)!.cards.push(card);
  }

  // Sort by category sort_order
  return Array.from(groups.values()).sort(
    (a, b) => a.category.sort_order - b.category.sort_order,
  );
});

function usePrompt(prompt: string) {
  emit("select", prompt);
  emit("update:open", false);
}

function handleCustomize(card: PromptCard) {
  customizingCard.value = card;
}

function handleCustomized(prompt: string) {
  customizingCard.value = null;
  usePrompt(prompt);
}
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    class="w-full max-w-2xl"
    @update:open="emit('update:open', $event)"
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
              <UIcon name="i-lucide-library" class="size-[18px]" />
            </span>
            <div>
              <h2 class="font-display font-bold text-base tracking-tight">
                Prompt Library
              </h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {{ filteredCards.length }} prompts
              </p>
            </div>
          </div>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="emit('update:open', false)"
          />
          <div
            class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />
        </div>

        <div class="px-5 pt-4 flex-shrink-0">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search prompts…"
            size="sm"
          />
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <div
            v-if="!filteredCards.length"
            class="text-center py-16 text-zinc-400 dark:text-zinc-500"
          >
            <UIcon
              name="i-lucide-search-x"
              class="size-8 mx-auto mb-2 opacity-50"
            />
            <p class="text-sm">No prompts found</p>
          </div>

          <div v-else class="space-y-6">
            <section
              v-for="group in groupedByCategory"
              :key="group.category.id"
              class="space-y-3"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  v-if="group.category.icon"
                  :name="group.category.icon"
                  class="size-4"
                  :style="{ color: group.category.color }"
                />
                <h3
                  class="text-xs font-semibold uppercase tracking-wider"
                  :style="{ color: group.category.color }"
                >
                  {{ group.category.name }}
                </h3>
                <div class="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div
                class="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
              >
                <div
                  v-for="item in group.cards"
                  :key="item.cardId"
                  class="flex-shrink-0 w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] snap-start flex flex-col"
                >
                  <PromptLibraryCard
                    :card="item"
                    class="flex-1"
                    @use="usePrompt"
                    @customize="handleCustomize"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        <div
          class="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0"
        >
          <NuxtLink to="/prompt-library" @click="emit('update:open', false)">
            <UButton
              variant="outline"
              color="neutral"
              block
              size="sm"
              icon="i-lucide-library"
            >
              Browse Full Library
            </UButton>
          </NuxtLink>
        </div>
      </div>
    </template>
  </USlideover>

  <PromptCustomizerModal
    v-if="customizingCard"
    :open="!!customizingCard"
    :card="customizingCard"
    @update:open="
      (v: boolean) => {
        if (!v) customizingCard = null;
      }
    "
    @use="handleCustomized"
  />
</template>
