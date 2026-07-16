import { DEFAULT_IMAGE_MODEL_ID, type AIModel } from "~/utils/models";
import { useAuthState } from "~/composables/useAuthState";

export function useModels() {
  const { session } = useAuthState();
  const models = useState<AIModel[]>("ai-models", () => []);
  const loading = useState<boolean>("ai-models-loading", () => false);
  const error = useState<string | null>("ai-models-error", () => null);

  async function fetchModels() {
    if (loading.value) return;
    loading.value = true;
    error.value = null;

    try {
      const data = await $fetch<AIModel[]>("/api/models");
      models.value = data ?? [];
    } catch (err: unknown) {
      error.value =
        err instanceof Error ? err.message : "Failed to load models";
    } finally {
      loading.value = false;
    }
  }

  async function fetchAllModels() {
    if (loading.value) return;
    loading.value = true;
    error.value = null;

    try {
      const data = await $fetch<AIModel[]>("/api/admin/models", {
        headers: {
          Authorization: `Bearer ${session.value?.access_token ?? ""}`,
        },
      });
      models.value = data ?? [];
    } catch (err: unknown) {
      error.value =
        err instanceof Error ? err.message : "Failed to load models";
    } finally {
      loading.value = false;
    }
  }

  // Prefer the configured default, then any recommended model, then first in list.
  // `recommended` can be true on many models (UI badge only).
  const firstModel = computed<AIModel | undefined>(
    () =>
      models.value.find((m) => m.id === DEFAULT_IMAGE_MODEL_ID) ??
      models.value.find((m) => m.recommended) ??
      models.value[0],
  );

  function getModelById(id: string): AIModel | undefined {
    return models.value.find((m) => m.id === id);
  }

  return {
    models,
    loading,
    error,
    fetchModels,
    fetchAllModels,
    firstModel,
    getModelById,
  };
}
