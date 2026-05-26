<script setup lang="ts">
import type { PromptCard } from "~/utils/promptLibrary";

const props = defineProps<{
  open: boolean;
  card: PromptCard;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  use: [prompt: string];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

const values = ref<Record<string, string>>({});
const expanded = ref<Record<string, boolean>>({});

watch(
  [() => props.card, () => props.open],
  ([card, open]) => {
    if (open) {
      values.value = Object.fromEntries(
        (card.placeholders ?? []).map((p) => [p.key, p.default ?? ""]),
      );
      expanded.value = Object.fromEntries(
        (card.placeholders ?? []).map((p) => [p.key, false]),
      );
    }
  },
  { immediate: true },
);

function toggle(key: string) {
  expanded.value[key] = !expanded.value[key];
}

function getDisplayValue(key: string, defaultVal?: string) {
  const v = values.value[key]?.trim();
  return v || defaultVal || null;
}

const previewParts = computed(() => {
  const parts: Array<{ text: string; filled: boolean }> = [];
  const source = props.card.prompt;
  const regex = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: source.slice(lastIndex, match.index), filled: false });
    }
    const key = match[1]!;
    const ph = props.card.placeholders.find((p) => p.key === key);
    const val = values.value[key]?.trim() || ph?.default;
    parts.push({ text: val || `[${key}]`, filled: !!val });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    parts.push({ text: source.slice(lastIndex), filled: false });
  }

  return parts;
});

function usePrompt() {
  let result = props.card.prompt;
  for (const ph of props.card.placeholders) {
    const val = values.value[ph.key]?.trim() || ph.default || "";
    result = result.replaceAll(`{{${ph.key}}}`, val);
  }
  emit("use", result);
  isOpen.value = false;
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="flex flex-col">
        <!-- Header -->
        <div
          class="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              v-if="card.image"
              class="size-8 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700"
            >
              <img
                :src="card.image"
                :alt="card.title"
                class="w-full h-full object-cover"
              />
            </div>
            <div class="min-w-0">
              <h3
                class="text-sm font-semibold text-zinc-900 dark:text-white truncate"
              >
                {{ card.title }}
              </h3>
              <p class="text-xs text-zinc-400 dark:text-zinc-500">
                Customize this prompt
              </p>
            </div>
          </div>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="isOpen = false"
          />
        </div>

        <!-- Scrollable body -->
        <div class="overflow-y-auto max-h-[55vh] px-4 py-3">
          <!-- 2-column grid of collapsible cards -->
          <div class="grid grid-cols-1 gap-2">
            <div
              v-for="placeholder in card.placeholders"
              :key="placeholder.key"
              class="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
            >
              <!-- Card header (toggle) -->
              <button
                type="button"
                class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                @click="toggle(placeholder.key)"
              >
                <div class="flex flex-col min-w-0">
                  <span
                    class="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate leading-tight"
                  >
                    {{ placeholder.label }}
                  </span>
                  <span
                    v-if="getDisplayValue(placeholder.key, placeholder.default)"
                    class="text-[11px] text-primary truncate leading-tight mt-0.5"
                  >
                    {{ getDisplayValue(placeholder.key, placeholder.default) }}
                  </span>
                  <span
                    v-else
                    class="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5"
                  >
                    Not set
                  </span>
                </div>
                <UIcon
                  name="i-lucide-chevron-down"
                  class="size-3.5 text-zinc-400 flex-shrink-0 transition-transform duration-150"
                  :class="expanded[placeholder.key] ? 'rotate-180' : ''"
                />
              </button>

              <!-- Card body -->
              <div
                v-show="expanded[placeholder.key]"
                class="px-3 pb-3 pt-0.5 border-t border-zinc-100 dark:border-zinc-700/60 space-y-2"
              >
                <div
                  v-if="placeholder.options?.length"
                  class="flex flex-wrap gap-1.5 pt-1"
                >
                  <button
                    v-for="opt in placeholder.options"
                    :key="opt"
                    type="button"
                    class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border"
                    :class="
                      values[placeholder.key] === opt
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-primary/60 hover:text-primary'
                    "
                    @click="
                      values[placeholder.key] =
                        values[placeholder.key] === opt
                          ? (placeholder.default ?? '')
                          : opt
                    "
                  >
                    {{ opt }}
                  </button>
                </div>
                <UInput
                  v-else
                  v-model="values[placeholder.key]"
                  :placeholder="
                    placeholder.hint ??
                    `Enter ${placeholder.label.toLowerCase()}…`
                  "
                  size="xs"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Preview strip -->
        <div
          class="mx-4 my-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/50 px-3 py-2.5 text-xs leading-relaxed max-h-40 overflow-y-auto"
        >
          <template v-for="(part, i) in previewParts" :key="i">
            <span
              :class="
                part.filled
                  ? 'text-primary font-medium'
                  : 'text-zinc-400 dark:text-zinc-500'
              "
              >{{ part.text }}</span
            >
          </template>
        </div>

        <!-- Footer -->
        <div
          class="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            @click="isOpen = false"
            >Cancel</UButton
          >
          <UButton icon="i-lucide-sparkles" size="sm" @click="usePrompt"
            >Use Prompt</UButton
          >
        </div>
      </div>
    </template>
  </UModal>
</template>
