const HINT_KEYS = [
  "model-selector",
  "prompt-library",
  "post-gen-tips",
] as const;

export type HintKey = (typeof HINT_KEYS)[number];

const LS_PREFIX = "lumiar_hint_";

export function useHints() {
  const dismissed = ref<Set<HintKey>>(new Set());

  onMounted(() => {
    const loaded = new Set<HintKey>();
    for (const key of HINT_KEYS) {
      if (localStorage.getItem(`${LS_PREFIX}${key}`) === "1") {
        loaded.add(key);
      }
    }
    dismissed.value = loaded;
  });

  function dismiss(key: HintKey) {
    localStorage.setItem(`${LS_PREFIX}${key}`, "1");
    dismissed.value = new Set([...dismissed.value, key]);
  }

  function isVisible(key: HintKey) {
    return !dismissed.value.has(key);
  }

  return { dismiss, isVisible };
}
