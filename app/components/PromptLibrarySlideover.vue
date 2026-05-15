<script setup lang="ts">
const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  select: [prompt: string];
}>();

const { categories, allPrompts, fetchLibrary } = usePromptLibrary();

watch(
  () => props.open,
  (val) => {
    if (val) fetchLibrary();
  },
  { immediate: true },
);

const search = ref("");
const selectedCategory = ref<string | null>(null);

const filtered = computed(() => {
  let list = allPrompts.value;
  if (selectedCategory.value) {
    list = list.filter((p) => p.category.id === selectedCategory.value);
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q),
    );
  }
  return list;
});

function usePrompt(prompt: string) {
  emit("select", prompt);
  emit("update:open", false);
}
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    class="w-full max-w-lg"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex flex-col h-full">
        <div
          class="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0"
        >
          <div>
            <h2 class="font-semibold text-base">Prompt Library</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {{ filtered.length }} prompts
            </p>
          </div>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="emit('update:open', false)"
          />
        </div>

        <div class="px-5 pt-4 space-y-3 flex-shrink-0">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search prompts…"
            size="sm"
          />

          <div class="flex gap-2 flex-wrap">
            <button
              class="text-xs px-3 py-1 rounded-full border transition-all"
              :class="
                selectedCategory === null
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300'
              "
              @click="selectedCategory = null"
            >
              All
            </button>
            <button
              v-for="cat in categories"
              :key="cat.id"
              class="text-xs px-3 py-1 rounded-full border transition-all"
              :class="
                selectedCategory === cat.id
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300'
              "
              @click="
                selectedCategory = selectedCategory === cat.id ? null : cat.id
              "
            >
              {{ cat.name }}
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <div
            v-if="!filtered.length"
            class="text-center py-16 text-zinc-400 dark:text-zinc-500"
          >
            <UIcon
              name="i-lucide-search-x"
              class="size-8 mx-auto mb-2 opacity-50"
            />
            <p class="text-sm">No prompts found</p>
          </div>

          <div
            v-for="item in filtered"
            :key="item.id"
            class="group flex gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
            @click="usePrompt(item.prompt)"
          >
            <div
              class="size-12 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-800"
            >
              <img
                v-if="item.image_urls?.[0]"
                :src="item.image_urls[0]"
                :alt="item.title"
                class="w-full h-full object-cover"
                loading="lazy"
                @error="
                  ($event.target as HTMLImageElement).style.display = 'none'
                "
              />
              <div
                v-else
                :class="`w-full h-full bg-gradient-to-br ${item.category.color} flex items-center justify-center`"
              >
                <UIcon
                  :name="item.category.icon"
                  class="size-5 text-white/80"
                />
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="mb-0.5">
                <p
                  class="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate"
                >
                  {{ item.title }}
                </p>
              </div>
              <p
                class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed"
              >
                {{ item.prompt }}
              </p>
            </div>

            <UIcon
              name="i-lucide-arrow-right"
              class="size-4 text-zinc-400 flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity"
            />
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
</template>
