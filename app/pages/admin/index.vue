<script setup lang="ts">
import type { AIModel, ModelTier, ModelProvider } from "~/utils/models";
import { TIER_CONFIG } from "~/utils/models";
import type { QualityOption } from "~/utils/quality";

definePageMeta({ middleware: ["admin"] });

const { session } = useAuthState();
const toast = useToast();

const models = ref<AIModel[]>([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref<string | null>(null);

const showSlide = ref(false);
const isEditing = ref(false);

type FormShape = {
  id: string;
  name: string;
  description: string;
  tier: ModelTier;
  provider: ModelProvider;
  tokens_per_generation: number;
  price_estimate: string;
  supports_image_input: boolean;
  max_image_inputs: number;
  max_resolution: string;
  quality_options: QualityOption[];
  default_quality: string;
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
  tokens_per_generation: 5,
  price_estimate: "",
  supports_image_input: true,
  max_image_inputs: 1,
  max_resolution: "",
  quality_options: [],
  default_quality: "",
  recommended: false,
  is_active: true,
  sort_order: 0,
});

function addQualityOption() {
  form.value.quality_options.push({
    value: "",
    label: "",
    hint: "",
    param: "",
    multiplier: 1,
  });
}
function removeQualityOption(index: number) {
  const [removed] = form.value.quality_options.splice(index, 1);
  if (removed && form.value.default_quality === removed.value) {
    form.value.default_quality = form.value.quality_options[0]?.value ?? "";
  }
}

const form = ref<FormShape>(emptyForm());

const authHeaders = computed(() => ({
  Authorization: `Bearer ${session.value?.access_token ?? ""}`,
}));

async function fetchModels() {
  loading.value = true;
  try {
    const data = await $fetch<AIModel[]>("/api/admin/models", {
      headers: authHeaders.value,
    });
    models.value = data ?? [];
  } catch {
    toast.add({ title: "Failed to load models", color: "error" });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = emptyForm();
  isEditing.value = false;
  showSlide.value = true;
}

function openEdit(model: AIModel) {
  form.value = {
    id: model.id,
    name: model.name,
    description: model.description,
    tier: model.tier,
    provider: model.provider,
    tokens_per_generation: model.tokens_per_generation,
    price_estimate: model.price_estimate,
    supports_image_input: model.supports_image_input,
    max_image_inputs: model.max_image_inputs ?? 1,
    max_resolution: model.max_resolution ?? "",
    quality_options: (model.quality_options ?? []).map((o) => ({
      value: o.value,
      label: o.label,
      hint: o.hint ?? "",
      param: o.param ?? "",
      multiplier: o.multiplier,
    })),
    default_quality: model.default_quality ?? "",
    recommended: model.recommended ?? false,
    is_active: model.is_active,
    sort_order: model.sort_order,
  };
  isEditing.value = true;
  showSlide.value = true;
}

async function saveModel() {
  if (!form.value.id.trim() || !form.value.name.trim()) {
    toast.add({ title: "ID and Name are required", color: "warning" });
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
      supports_image_input: Boolean(form.value.supports_image_input),
      max_image_inputs: Number(form.value.max_image_inputs),
      max_resolution: form.value.max_resolution.trim() || null,
      quality_options: form.value.quality_options
        .filter((o) => o.value.trim())
        .map((o) => ({
          value: o.value.trim(),
          label: o.label.trim() || o.value.trim(),
          hint: o.hint?.trim() || undefined,
          param: o.param?.trim() || undefined,
          multiplier: Number(o.multiplier) || 1,
        })),
      default_quality: form.value.default_quality.trim() || null,
      recommended: Boolean(form.value.recommended),
      is_active: Boolean(form.value.is_active),
      sort_order: Number(form.value.sort_order),
    };

    if (isEditing.value) {
      await $fetch(`/api/admin/models/${encodeURIComponent(form.value.id)}`, {
        method: "PATCH",
        headers: authHeaders.value,
        body: payload,
      });
      toast.add({ title: "Model updated", color: "success" });
    } else {
      await $fetch("/api/admin/models", {
        method: "POST",
        headers: authHeaders.value,
        body: { id: form.value.id.trim(), ...payload },
      });
      toast.add({ title: "Model created", color: "success" });
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

async function toggleActive(model: AIModel) {
  const next = !model.is_active;
  try {
    await $fetch(`/api/admin/models/${encodeURIComponent(model.id)}`, {
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
    await $fetch(`/api/admin/models/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders.value,
    });
    models.value = models.value.filter((m) => m.id !== id);
    toast.add({ title: "Model deleted", color: "success" });
  } catch {
    toast.add({ title: "Failed to delete model", color: "error" });
  } finally {
    deleting.value = null;
  }
}

const tierBadgeClass: Record<ModelTier, string> = {
  high: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400",
  mid: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400",
  low: "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400",
};

const tierOptions: { label: string; value: ModelTier; color: string }[] = [
  { label: "Low", value: "low", color: "text-green-600 dark:text-green-400" },
  { label: "Mid", value: "mid", color: "text-blue-600 dark:text-blue-400" },
  { label: "High", value: "high", color: "text-amber-600 dark:text-amber-400" },
];

const providerOptions: { label: string; value: ModelProvider; icon: string }[] =
  [
    { label: "OpenRouter", value: "openrouter", icon: "i-lucide-waypoints" },
    { label: "OpenAI", value: "openai", icon: "i-lucide-sparkles" },
    { label: "Google", value: "google", icon: "i-lucide-brain-circuit" },
  ];

const activeTab = ref<
  "models" | "video-models" | "prompts" | "users" | "landing"
>("models");

await fetchModels();
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-10">
    <!-- Page header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <span
          class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 flex-shrink-0"
        >
          <UIcon name="i-lucide-shield" class="size-5" />
        </span>
        <div>
          <h1 class="font-display text-2xl font-bold tracking-tight">
            Admin Dashboard
          </h1>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Manage models, prompts and library content
          </p>
        </div>
      </div>
    </div>

    <!-- Tab switcher -->
    <div
      class="flex items-center gap-0.5 p-1 rounded-full bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 mb-8 w-fit"
    >
      <button
        v-for="tab in [
          { id: 'models', label: 'AI Models', icon: 'i-lucide-cpu' },
          {
            id: 'video-models',
            label: 'Video Models',
            icon: 'i-lucide-clapperboard',
          },
          { id: 'prompts', label: 'Prompt Library', icon: 'i-lucide-library' },
          { id: 'landing', label: 'Landing Pages', icon: 'i-lucide-wand-2' },
          { id: 'users', label: 'Users', icon: 'i-lucide-users' },
        ]"
        :key="tab.id"
        type="button"
        class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all"
        :class="
          activeTab === tab.id
            ? 'bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
        "
        @click="
          activeTab = tab.id as
            | 'models'
            | 'video-models'
            | 'prompts'
            | 'users'
            | 'landing'
        "
      >
        <UIcon
          :name="tab.icon"
          class="size-4"
          :class="activeTab === tab.id ? 'text-primary' : ''"
        />
        <span :class="activeTab === tab.id ? 'text-gradient-brand' : ''">{{
          tab.label
        }}</span>
      </button>
    </div>

    <!-- ── AI Models tab ── -->
    <div v-show="activeTab === 'models'">
      <!-- Add button -->
      <div class="flex justify-end mb-5">
        <UButton
          icon="i-lucide-plus"
          class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
          @click="openCreate"
          >Add Model</UButton
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
          <UIcon name="i-lucide-cpu" class="size-10" />
          <p class="text-sm">No models yet.</p>
          <UButton
            variant="outline"
            size="sm"
            icon="i-lucide-plus"
            @click="openCreate"
          >
            Add your first model
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
                <th class="text-left px-4 py-3 hidden md:table-cell">
                  Provider
                </th>
                <th class="text-center px-4 py-3 hidden md:table-cell">
                  Tokens
                </th>
                <th class="text-left px-4 py-3 hidden lg:table-cell">Price</th>
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
                    <span
                      class="font-medium text-zinc-900 dark:text-zinc-100"
                      >{{ model.name }}</span
                    >
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
                    {{ TIER_CONFIG[model.tier].label }}
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
                  class="px-4 py-3 hidden lg:table-cell text-xs text-zinc-400 dark:text-zinc-500"
                >
                  {{ model.price_estimate }}
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
        :title="isEditing ? 'Edit Model' : 'Add New Model'"
        :description="
          isEditing
            ? `Editing ${form.id}`
            : 'Fill in the details for the new AI model'
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
                hint="e.g. openai/gpt-image-2"
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
                <UInput v-model="form.name" placeholder="e.g. GPT Image 2" />
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

              <div>
                <p
                  class="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  Provider
                </p>
                <div class="flex gap-2">
                  <button
                    v-for="opt in providerOptions"
                    :key="opt.value"
                    type="button"
                    class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all"
                    :class="
                      form.provider === opt.value
                        ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary ring-1 ring-primary/20'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                    "
                    @click="form.provider = opt.value"
                  >
                    <UIcon :name="opt.icon" class="size-3.5" />
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
                <UFormField label="Tokens / Generation">
                  <UInput
                    v-model.number="form.tokens_per_generation"
                    type="number"
                    min="1"
                    max="100"
                  />
                </UFormField>
                <UFormField label="Price Estimate">
                  <UInput
                    v-model="form.price_estimate"
                    placeholder="~$0.05/image"
                  />
                </UFormField>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Max Resolution">
                  <UInput
                    v-model="form.max_resolution"
                    placeholder="1024×1024"
                  />
                </UFormField>
                <UFormField label="Sort Order">
                  <UInput
                    v-model.number="form.sort_order"
                    type="number"
                    min="0"
                  />
                </UFormField>
              </div>
            </div>

            <USeparator />

            <!-- Quality tiers -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <p
                  class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
                >
                  Quality tiers
                </p>
                <UButton
                  size="xs"
                  variant="soft"
                  icon="i-lucide-plus"
                  @click="addQualityOption"
                >
                  Add tier
                </UButton>
              </div>
              <p class="text-xs text-zinc-400 dark:text-zinc-500">
                Leave empty for no quality control. Credits =
                tokens/generation × multiplier. Param is the provider value
                (OpenAI quality: medium/high · Gemini imageSize: 1K/2K/4K).
              </p>

              <div
                v-for="(opt, i) in form.quality_options"
                :key="i"
                class="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2"
              >
                <div class="flex items-center gap-2">
                  <UInput
                    v-model="opt.value"
                    placeholder="value (e.g. standard)"
                    class="flex-1"
                    size="sm"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    size="xs"
                    @click="removeQualityOption(i)"
                  />
                </div>
                <UInput
                  v-model="opt.label"
                  placeholder="label (e.g. Standard (2K))"
                  size="sm"
                />
                <UInput
                  v-model="opt.hint"
                  placeholder="hint (e.g. Best for web & social)"
                  size="sm"
                />
                <div class="grid grid-cols-2 gap-2">
                  <UInput
                    v-model="opt.param"
                    placeholder="param (e.g. 2K)"
                    size="sm"
                  />
                  <UInput
                    v-model.number="opt.multiplier"
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="multiplier"
                    size="sm"
                  />
                </div>
                <label
                  class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer"
                >
                  <input
                    type="radio"
                    :checked="form.default_quality === opt.value"
                    :disabled="!opt.value"
                    @change="form.default_quality = opt.value"
                  />
                  Default tier
                </label>
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
                    <p
                      class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Active
                    </p>
                    <p class="text-xs text-zinc-400 dark:text-zinc-500">
                      Visible to users in the model picker
                    </p>
                  </div>
                  <USwitch v-model="form.is_active" />
                </label>
                <label
                  class="flex items-center justify-between cursor-pointer group"
                >
                  <div>
                    <p
                      class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
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
                    <p
                      class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Supports image input
                    </p>
                    <p class="text-xs text-zinc-400 dark:text-zinc-500">
                      Model accepts an input image for editing
                    </p>
                  </div>
                  <USwitch v-model="form.supports_image_input" />
                </label>
              </div>

              <div v-if="form.supports_image_input" class="flex flex-col gap-1">
                <label
                  class="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
                  >Max reference images</label
                >
                <UInput
                  v-model.number="form.max_image_inputs"
                  type="number"
                  :min="1"
                  :max="8"
                  placeholder="1"
                />
                <p class="text-xs text-zinc-400 dark:text-zinc-500">
                  How many input images this model can handle (1–8)
                </p>
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

    <!-- ── Video Models tab ── -->
    <div v-show="activeTab === 'video-models'">
      <AdminVideoModelManagement />
    </div>

    <!-- ── Prompt Library tab ── -->
    <div v-show="activeTab === 'prompts'">
      <AdminPromptLibraryAdmin />
    </div>

    <!-- ── Landing Pages tab ── -->
    <div v-show="activeTab === 'landing'">
      <AdminLandingExamplesAdmin />
    </div>

    <!-- ── Users tab ── -->
    <div v-show="activeTab === 'users'">
      <AdminUserManagement />
    </div>
  </div>
</template>
