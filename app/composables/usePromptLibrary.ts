import type { PromptCategory, PromptCard } from "~/utils/promptLibrary";

export function usePromptLibrary() {
  const categories = useState<PromptCategory[]>(
    "prompt-library-categories",
    () => [],
  );
  const loading = ref(false);

  async function fetchLibrary(force = false) {
    if (!force && categories.value.length > 0) return;
    loading.value = true;
    try {
      const data = await $fetch<PromptCategory[]>("/api/prompt-library");
      categories.value = data ?? [];
    } catch {
      // non-fatal; UI will show empty state
    } finally {
      loading.value = false;
    }
  }

  const allPrompts = computed(() =>
    categories.value.flatMap((cat) =>
      cat.prompts.map((p) => ({ ...p, category: cat })),
    ),
  );

  const promptCards = computed((): PromptCard[] => {
    const cards: PromptCard[] = [];
    for (const cat of categories.value) {
      for (const prompt of cat.prompts) {
        if (!prompt.image_urls?.length) {
          cards.push({
            cardId: prompt.id,
            promptId: prompt.id,
            title: prompt.title,
            prompt: prompt.prompt,
            image: null,
            category: cat,
            placeholders: prompt.placeholders,
          });
        } else {
          prompt.image_urls.forEach((url: string, i: number) => {
            cards.push({
              cardId: `${prompt.id}-${i + 1}`,
              promptId: prompt.id,
              title: prompt.title,
              prompt: prompt.prompt,
              image: url,
              category: cat,
              placeholders: prompt.placeholders,
            });
          });
        }
      }
    }
    return cards;
  });

  return { categories, loading, fetchLibrary, allPrompts, promptCards };
}
