<script setup lang="ts">
import type {
  VideoModel,
  VideoModelTier,
  VideoProvider,
} from "~/utils/videoModels";
import { VIDEO_TIER_CONFIG } from "~/utils/videoModels";
import { VIDEO_ASPECT_RATIOS } from "~/utils/constants";

const { session } = useAuthState();
const toast = useToast();

const models = ref<VideoModel[]>([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref<string | null>(null);

const showSlide = ref(false);
const isEditing = ref(false);

type FormShape = {
  id: string;
  name: string;
  description: string;
  tier: VideoModelTier;
  provider: VideoProvider;
  tokens_per_generation: number;
  price_estimate: string;
  duration_seconds: number;
  supported_durations: string;
  resolution: string;
  supports_image_input: boolean;
  supported_aspect_ratios: string[];
  recommended: boolean;
  is_active: boolean;
  sort_order: number;
};

const emptyForm = (): FormShape => ({
  id: "",
  name: "",
  description: "",
  tier: "mid",
  provider: "openrouter",
  tokens_per_generation: 250,
  price_estimate: "",
  duration_seconds: 5,
  supported_durations: "5",
  resolution: "720p",
  supports_image_input: true,
  supported_aspect_ratios: ["16:9", "9:16", "1:1"],
  recommended: false,
  is_active: true,
  sort_order: 0,
});

const form = ref<FormShape>(emptyForm());

const authHeaders = computed(() => ({
  Authorization: `Bearer ${session.value?.access_token ?? ""}`,
}));

async function fetchModels() {
  loading.value = true;
  try {
    const data = await $fetch<VideoModel[]>("/api/admin/video-models", {
      headers: authHeaders.value,
    });
    models.value = data ?? [];
  } catch {
    toast.add({ title: "Failed to load video models", color: "error" });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = emptyForm();
  isEditing.value = false;
  showSlide.value = true;
}

function openEdit(model: VideoModel) {
  form.value = {
    id: model.id,
    name: model.name,
    description: model.description,
    tier: model.tier,
    provider: model.provider,
    tokens_per_generation: model.tokens_per_generation,
    price_estimate: model.price_estimate,
    duration_seconds: model.duration_seconds,
    supported_durations: (model.supported_durations ?? [model.duration_seconds])
      .join(", "),
    resolution: model.resolution,
    supports_image_input: model.supports_image_input,
    supported_aspect_ratios: [...(model.supported_aspect_ratios ?? [])],
    recommended: model.recommended ?? false,
    is_active: model.is_active,
    sort_order: model.sort_order,
  };
  isEditing.value = true;
  showSlide.value = true;
}

function toggleAspectRatio(value: string) {
  const set = new Set(form.value.supported_aspect_ratios);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  form.value.supported_aspect_ratios = [...set];
}

async function saveModel() {
  if (!form.value.id.trim() || !form.value.name.trim()) {
    toast.add({ title: "ID and Name are required", color: "warning" });
    return;
  }
  if (form.value.supported_aspect_ratios.length === 0) {
    toast.add({ title: "Select at least one aspect ratio", color: "warning" });
    return;
  }
  const durations = form.value.supported_durations
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (durations.length === 0) {
    toast.add({
      title: "Add at least one duration (e.g. 5, 8)",
      color: "warning",
    });
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      tier: form.value.tier,
      provider: form.value.provider,
      tokens_per_generation: Number(form.value.tokens_per_generation),
      price_estimate: form.value.price_estimate.trim(),
      duration_seconds: Number(form.value.duration_seconds),
      supported_durations: durations,
      resolution: form.value.resolution.trim() || "720p",
      supports_image_input: Boolean(form.value.supports_image_input),
      supported_aspect_ratios: form.value.supported_aspect_ratios,
      recommended: Boolean(form.value.recommended),
      is_active: Boolean(form.value.is_active),
      sort_order: Number(form.value.sort_order),
    };

    if (isEditing.value) {
      await $fetch(
        `/api/admin/video-models/${encodeURIComponent(form.value.id)}`,
        {
          method: "PATCH",
          headers: authHeaders.value,
          body: payload,
        },
      );
      toast.add({ title: "Video model updated", color: "success" });
    } else {
      await $fetch("/api/admin/video-models", {
        method: "POST",
        headers: authHeaders.value,
        body: { id: form.value.id.trim(), ...payload },
      });
      toast.add({ title: "Video model created", color: "success" });
    }
    showSlide.value = false;
    await fetchModels();
  } catch (err: unknown) {
    const raw = err as { data?: { message?: string }; message?: string };
    const msg = raw?.data?.message ?? raw?.message ?? "Save failed";
    toast.add({ title: "Save failed", description: msg, color: "error" });
  } finally {
    saving.value = false;
  }
}

async function toggleActive(model: VideoModel) {
  const next = !model.is_active;
  try {
    await $fetch(`/api/admin/video-models/${encodeURIComponent(model.id)}`, {
      method: "PATCH",
      headers: authHeaders.value,
      body: { is_active: next },
    });
    model.is_active = next;
  } catch {
    toast.add({ title: "Failed to update model", color: "error" });
  }
}

async function deleteModel(id: string) {
  deleting.value = id;
  try {
    await $fetch(`/api/admin/video-models/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders.value,
    });
    models.value = models.value.filter((m) => m.id !== id);
    toast.add({ title: "Video model deleted", color: "success" });
  } catch {
    toast.add({ title: "Failed to delete model", color: "error" });
  } finally {
    deleting.value = null;
  }
}

const tierBadgeClass: Record<VideoModelTier, string> = {
  high: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400",
  mid: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400",
  low: "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400",
};

const tierOptions: { label: string; value: VideoModelTier }[] = [
  { label: "Low", value: "low" },
  { label: "Mid", value: "mid" },
  { label: "High", value: "high" },
];

onMounted(fetchModels);
</script>

<template>
  <div>
    <!-- Add button -->
    <div class="flex justify-end mb-5">
      <UButton
        icon="i-lucide-plus"
        class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
        @click="openCreate"
        >Add Video Model</UButton
      >
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <template v-else>
      <!-- Empty state -->
      <div
        v-if="models.length === 0"
        class="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400"
      >
        <UIcon name="i-lucide-clapperboard" class="size-10" />
        <p class="text-sm">No video models yet.</p>
        <UButton
          variant="outline"
          size="sm"
          icon="i-lucide-plus"
          @click="openCreate"
        >
          Add your first video model
        </UButton>
      </div>

      <!-- Table -->
      <div
        v-else
        class="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <table class="w-full text-sm">
          <thead>
            <tr
              class="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              <th class="text-left px-4 py-3">Model</th>
              <th class="text-left px-4 py-3 hidden lg:table-cell">ID</th>
              <th class="text-left px-4 py-3">Tier</th>
              <th class="text-left px-4 py-3 hidden md:table-cell">Provider</th>
              <th class="text-center px-4 py-3 hidden md:table-cell">Credits</th>
              <th class="text-center px-4 py-3 hidden lg:table-cell">Length</th>
              <th class="text-left px-4 py-3 hidden lg:table-cell">Res</th>
              <th class="text-center px-4 py-3">Active</th>
              <th class="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
            <tr
              v-for="model in models"
              :key="model.id"
              class="group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
              :class="!model.is_active ? 'opacity-40' : ''"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5">
                  <span class="font-medium text-zinc-900 dark:text-zinc-100">{{
                    model.name
                  }}</span>
                  <span
                    v-if="model.recommended"
                    class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-primary/20 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary"
                  >
                    <UIcon name="i-lucide-star" class="size-2.5" />
                    Pick
                  </span>
                </div>
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-[200px] truncate"
                >
                  {{ model.description }}
                </p>
              </td>
              <td
                class="px-4 py-3 hidden lg:table-cell font-mono text-xs text-zinc-400 dark:text-zinc-500"
              >
                {{ model.id }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  :class="tierBadgeClass[model.tier]"
                >
                  {{ VIDEO_TIER_CONFIG[model.tier].label }}
                </span>
              </td>
              <td
                class="px-4 py-3 hidden md:table-cell text-xs text-zinc-500 dark:text-zinc-400 capitalize"
              >
                {{ model.provider }}
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-center">
                <span
                  class="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300"
                >
                  <UIcon name="i-lucide-zap" class="size-3 text-amber-500" />
                  {{ model.tokens_per_generation }}
                </span>
              </td>
              <td
                class="px-4 py-3 hidden lg:table-cell text-center text-xs text-zinc-500 dark:text-zinc-400"
              >
                {{ model.duration_seconds }}s
              </td>
              <td
                class="px-4 py-3 hidden lg:table-cell text-xs text-zinc-400 dark:text-zinc-500"
              >
                {{ model.resolution }}
              </td>
              <td class="px-4 py-3 text-center">
                <USwitch
                  :model-value="model.is_active"
                  size="xs"
                  @update:model-value="toggleActive(model)"
                />
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    icon="i-lucide-pencil"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="openEdit(model)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    size="xs"
                    :loading="deleting === model.id"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="deleteModel(model.id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Slideover form panel -->
    <USlideover
      v-model:open="showSlide"
      :title="isEditing ? 'Edit Video Model' : 'Add New Video Model'"
      :description="
        isEditing
          ? `Editing ${form.id}`
          : 'Fill in the details for the new video model'
      "
      side="right"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #body>
        <div class="px-6 py-5 space-y-6 overflow-y-auto">
          <!-- Identity -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Identity
            </p>
            <UFormField
              label="Model ID"
              required
              hint="maker/model, e.g. google/veo-3.1 (groups by maker)"
            >
              <UInput
                v-model="form.id"
                placeholder="provider/model-name"
                :disabled="isEditing"
                class="font-mono"
                :class="isEditing ? 'opacity-60' : ''"
              />
            </UFormField>
            <UFormField label="Display Name" required>
              <UInput v-model="form.name" placeholder="e.g. Veo 3.1 Fast" />
            </UFormField>
            <UFormField label="Description">
              <UTextarea
                v-model="form.description"
                placeholder="Short description shown to users in the model picker"
                :rows="2"
              />
            </UFormField>
          </div>

          <USeparator />

          <!-- Classification -->
          <div class="space-y-4">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Classification
            </p>

            <div>
              <p
                class="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Tier
              </p>
              <div class="flex gap-2">
                <button
                  v-for="opt in tierOptions"
                  :key="opt.value"
                  type="button"
                  class="flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all"
                  :class="
                    form.tier === opt.value
                      ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary ring-1 ring-primary/20'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  "
                  @click="form.tier = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>

          <USeparator />

          <!-- Pricing & Specs -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Pricing & Specs
            </p>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Credits / Generation">
                <UInput
                  v-model.number="form.tokens_per_generation"
                  type="number"
                  min="1"
                  max="5000"
                />
              </UFormField>
              <UFormField label="Price Estimate">
                <UInput
                  v-model="form.price_estimate"
                  placeholder="~$2.50 / clip"
                />
              </UFormField>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <UFormField label="Default (s)">
                <UInput
                  v-model.number="form.duration_seconds"
                  type="number"
                  min="1"
                  max="60"
                />
              </UFormField>
              <UFormField label="Resolution">
                <UInput v-model="form.resolution" placeholder="720p" />
              </UFormField>
              <UFormField label="Sort Order">
                <UInput
                  v-model.number="form.sort_order"
                  type="number"
                  min="0"
                />
              </UFormField>
            </div>
            <UFormField
              label="Selectable durations (seconds)"
              hint="comma-separated; credits scale linearly with duration"
            >
              <UInput
                v-model="form.supported_durations"
                placeholder="4, 6, 8"
              />
            </UFormField>

            <div>
              <p
                class="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Supported aspect ratios
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="ratio in VIDEO_ASPECT_RATIOS"
                  :key="ratio.value"
                  type="button"
                  class="py-1.5 px-3 rounded-lg border text-sm font-medium transition-all"
                  :class="
                    form.supported_aspect_ratios.includes(ratio.value)
                      ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary ring-1 ring-primary/20'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  "
                  @click="toggleAspectRatio(ratio.value)"
                >
                  {{ ratio.value }}
                </button>
              </div>
            </div>
          </div>

          <USeparator />

          <!-- Flags -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Flags
            </p>
            <div class="space-y-3">
              <label
                class="flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Active
                  </p>
                  <p class="text-xs text-zinc-400 dark:text-zinc-500">
                    Visible to users in the video model picker
                  </p>
                </div>
                <USwitch v-model="form.is_active" />
              </label>
              <label
                class="flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Recommended
                  </p>
                  <p class="text-xs text-zinc-400 dark:text-zinc-500">
                    Shows a "Recommended" badge on the model
                  </p>
                </div>
                <USwitch v-model="form.recommended" />
              </label>
              <label
                class="flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Supports image input
                  </p>
                  <p class="text-xs text-zinc-400 dark:text-zinc-500">
                    Model accepts a start-frame image (image-to-video)
                  </p>
                </div>
                <USwitch v-model="form.supports_image_input" />
              </label>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div
          class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800"
        >
          <UButton variant="ghost" color="neutral" @click="showSlide = false">
            Cancel
          </UButton>
          <UButton
            :loading="saving"
            :icon="isEditing ? 'i-lucide-save' : 'i-lucide-plus'"
            class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
            @click="saveModel"
          >
            {{ isEditing ? "Save Changes" : "Create Model" }}
          </UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
