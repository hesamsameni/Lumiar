<script setup lang="ts">
useHead({ title: "Prompt Library — Lumiar" });

const router = useRouter();
const toast = useToast();
const { categories, promptCards, fetchLibrary } = usePromptLibrary();

await fetchLibrary();

const search = ref("");
const selectedCategory = ref<string | null>(null);

const groupedCards = computed(() => {
  let filtered = promptCards.value;

  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.prompt.toLowerCase().includes(q),
    );
  }

  if (selectedCategory.value) {
    filtered = filtered.filter((c) => c.category.id === selectedCategory.value);
    const cat = categories.value.find((c) => c.id === selectedCategory.value);
    return cat ? [{ category: cat, cards: filtered }] : [];
  }

  const groupMap = new Map<
    string,
    { category: (typeof filtered)[0]["category"]; cards: typeof filtered }
  >();
  for (const card of filtered) {
    if (!groupMap.has(card.category.id)) {
      groupMap.set(card.category.id, { category: card.category, cards: [] });
    }
    groupMap.get(card.category.id)!.cards.push(card);
  }
  return Array.from(groupMap.values()).filter((g) => g.cards.length > 0);
});

const totalCount = computed(() =>
  groupedCards.value.reduce((sum, g) => sum + g.cards.length, 0),
);

function handleUsePrompt(prompt: string) {
  router.push({ path: "/", query: { prompt } });
  toast.add({
    title: "Prompt loaded",
    description: "Your prompt has been pre-filled on the generate page.",
    color: "success",
  });
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-10">
    <div class="mb-8">
      <div
        class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-1"
      >
        <div>
          <h1 class="text-3xl font-bold tracking-tight mb-1">Prompt Library</h1>
          <p class="text-zinc-500 dark:text-zinc-400">
            Curated prompts to spark your creativity
          </p>
        </div>
        <UButton to="/" icon="i-lucide-sparkles" size="sm">
          Go to Generate
        </UButton>
      </div>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search prompts…"
        class="flex-1"
      />
    </div>

    <div class="flex flex-wrap gap-2 mb-8">
      <button
        class="text-xs px-3 py-1.5 rounded-full border transition-all"
        :class="
          selectedCategory === null
            ? 'border-primary bg-primary/10 text-primary font-medium'
            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
        "
        @click="selectedCategory = null"
      >
        All
      </button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="text-xs px-3 py-1.5 rounded-full border transition-all"
        :class="
          selectedCategory === cat.id
            ? 'border-primary bg-primary/10 text-primary font-medium'
            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
        "
        @click="selectedCategory = selectedCategory === cat.id ? null : cat.id"
      >
        {{ cat.name }}
      </button>
    </div>

    <div
      v-if="!totalCount"
      class="text-center py-24 text-zinc-400 dark:text-zinc-500"
    >
      <UIcon name="i-lucide-search-x" class="size-12 mx-auto mb-3 opacity-50" />
      <p class="text-base font-medium">No prompts found</p>
      <p class="text-sm mt-1">Try a different search or category</p>
    </div>

    <div v-else class="space-y-12">
      <section v-for="group in groupedCards" :key="group.category.id">
        <div v-if="!selectedCategory" class="flex items-center gap-3 mb-5">
          <div
            class="size-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0"
          >
            <UIcon
              :name="group.category.icon"
              class="size-4 text-zinc-500 dark:text-zinc-400"
            />
          </div>
          <div>
            <h2 class="font-semibold text-base leading-tight">
              {{ group.category.name }}
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              {{ group.category.description }}
            </p>
          </div>
          <span
            class="ml-auto text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0"
          >
            {{ group.cards.length }}
            {{ group.cards.length === 1 ? "card" : "cards" }}
          </span>
        </div>

        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
        >
          <PromptLibraryCard
            v-for="card in group.cards"
            :key="card.cardId"
            :card="card"
            @use="handleUsePrompt"
          />
        </div>
      </section>
    </div>
  </div>
</template>
