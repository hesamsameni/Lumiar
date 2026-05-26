<script setup lang="ts">
import type {
  PromptCategory,
  PromptItem,
  PromptPlaceholder,
} from "~/utils/promptLibrary";
import { compressImage } from "~/utils/imageCompression";

const { session } = useAuthState();
const toast = useToast();

const authHeaders = computed(() => ({
  Authorization: `Bearer ${session.value?.access_token ?? ""}`,
}));

// ─── Categories ──────────────────────────────────────────────────────────────

const categories = ref<PromptCategory[]>([]);
const loadingCats = ref(false);
const savingCat = ref(false);
const deletingCat = ref<string | null>(null);
const showCatSlide = ref(false);
const isEditingCat = ref(false);

type CatForm = {
  id: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
};

const emptyCatForm = (): CatForm => ({
  id: "",
  name: "",
  description: "",
  icon: "i-lucide-sparkles",
  sort_order: 0,
  is_active: true,
});
const catForm = ref<CatForm>(emptyCatForm());
const catIdEditable = ref(false);

watch(
  () => catForm.value.name,
  (name) => {
    if (isEditingCat.value || catIdEditable.value) return;
    catForm.value.id = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  },
);

async function fetchCategories() {
  loadingCats.value = true;
  try {
    const data = await $fetch<PromptCategory[]>(
      "/api/admin/prompt-library/categories",
      { headers: authHeaders.value },
    );
    categories.value = (data ?? []).map((c) => ({ ...c, prompts: [] }));
  } catch {
    toast.add({ title: "Failed to load categories", color: "error" });
  } finally {
    loadingCats.value = false;
  }
}

function openCreateCat() {
  catForm.value = emptyCatForm();
  isEditingCat.value = false;
  catIdEditable.value = false;
  showCatSlide.value = true;
}

function openEditCat(cat: PromptCategory) {
  catForm.value = {
    id: cat.id,
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    sort_order: cat.sort_order,
    is_active: cat.is_active,
  };
  isEditingCat.value = true;
  catIdEditable.value = false;
  showCatSlide.value = true;
}

async function saveCat() {
  if (!catForm.value.id.trim() || !catForm.value.name.trim()) {
    toast.add({ title: "ID and Name are required", color: "warning" });
    return;
  }
  savingCat.value = true;
  try {
    const payload = {
      name: catForm.value.name.trim(),
      description: catForm.value.description.trim(),
      icon: catForm.value.icon.trim(),
      sort_order: Number(catForm.value.sort_order),
      is_active: Boolean(catForm.value.is_active),
    };
    if (isEditingCat.value) {
      await $fetch(
        `/api/admin/prompt-library/categories/${encodeURIComponent(catForm.value.id)}`,
        { method: "PATCH", headers: authHeaders.value, body: payload },
      );
      toast.add({ title: "Category updated", color: "success" });
    } else {
      await $fetch("/api/admin/prompt-library/categories", {
        method: "POST",
        headers: authHeaders.value,
        body: { id: catForm.value.id.trim(), ...payload },
      });
      toast.add({ title: "Category created", color: "success" });
    }
    showCatSlide.value = false;
    await fetchCategories();
  } catch (err: unknown) {
    const raw = err as { data?: { message?: string }; message?: string };
    toast.add({
      title: "Save failed",
      description: raw?.data?.message ?? raw?.message,
      color: "error",
    });
  } finally {
    savingCat.value = false;
  }
}

async function deleteCat(id: string) {
  deletingCat.value = id;
  try {
    await $fetch(
      `/api/admin/prompt-library/categories/${encodeURIComponent(id)}`,
      { method: "DELETE", headers: authHeaders.value },
    );
    categories.value = categories.value.filter((c) => c.id !== id);
    toast.add({ title: "Category deleted", color: "success" });
  } catch {
    toast.add({ title: "Failed to delete category", color: "error" });
  } finally {
    deletingCat.value = null;
  }
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const prompts = ref<PromptItem[]>([]);
const loadingPrompts = ref(false);
const savingPrompt = ref(false);
const deletingPrompt = ref<string | null>(null);
const showPromptSlide = ref(false);
const isEditingPrompt = ref(false);
const uploadingImage = ref(false);
const imageInputRef = ref<HTMLInputElement | null>(null);
const filterCategoryId = ref<string>("");

type PromptForm = {
  id: string;
  category_id: string;
  title: string;
  prompt: string;
  image_urls: string[];
  placeholders: PromptPlaceholder[];
  sort_order: number;
  is_active: boolean;
};

const emptyPromptForm = (): PromptForm => ({
  id: "",
  category_id: categories.value[0]?.id ?? "",
  title: "",
  prompt: "",
  image_urls: [],
  placeholders: [],
  sort_order: 0,
  is_active: true,
});
const promptForm = ref<PromptForm>(emptyPromptForm());
const promptIdEditable = ref(false);

watch(
  () => promptForm.value.title,
  (title) => {
    if (isEditingPrompt.value || promptIdEditable.value) return;
    promptForm.value.id = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  },
);

const filteredPrompts = computed(() =>
  filterCategoryId.value
    ? prompts.value.filter((p) => p.category_id === filterCategoryId.value)
    : prompts.value,
);

async function fetchPrompts() {
  loadingPrompts.value = true;
  try {
    const data = await $fetch<PromptItem[]>(
      "/api/admin/prompt-library/prompts",
      { headers: authHeaders.value },
    );
    prompts.value = data ?? [];
  } catch {
    toast.add({ title: "Failed to load prompts", color: "error" });
  } finally {
    loadingPrompts.value = false;
  }
}

function openCreatePrompt() {
  promptForm.value = emptyPromptForm();
  isEditingPrompt.value = false;
  promptIdEditable.value = false;
  showPromptSlide.value = true;
}

function openEditPrompt(p: PromptItem) {
  promptForm.value = {
    id: p.id,
    category_id: p.category_id,
    title: p.title,
    prompt: p.prompt,
    image_urls: [...(p.image_urls ?? [])],
    placeholders: (p.placeholders ?? []).map((ph) => ({ ...ph })),
    sort_order: p.sort_order,
    is_active: p.is_active,
  };
  isEditingPrompt.value = true;
  promptIdEditable.value = false;
  showPromptSlide.value = true;
}

async function handleImageSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploadingImage.value = true;
  try {
    // Compress client-side to avoid FUNCTION_PAYLOAD_TOO_LARGE
    const compressed = await compressImage(file);
    const fd = new FormData();
    fd.append("file", compressed);
    fd.append("promptId", promptForm.value.id || "new");
    const { url } = await $fetch<{ url: string }>(
      "/api/admin/prompt-library/upload-image",
      { method: "POST", headers: authHeaders.value, body: fd },
    );
    promptForm.value.image_urls = [...promptForm.value.image_urls, url];
  } catch {
    toast.add({ title: "Image upload failed", color: "error" });
  } finally {
    uploadingImage.value = false;
    if (imageInputRef.value) imageInputRef.value.value = "";
  }
}

function removeImage(index: number) {
  promptForm.value.image_urls = promptForm.value.image_urls.filter(
    (_, i) => i !== index,
  );
}

async function savePrompt() {
  if (
    !promptForm.value.id.trim() ||
    !promptForm.value.title.trim() ||
    !promptForm.value.category_id
  ) {
    toast.add({
      title: "ID, Title and Category are required",
      color: "warning",
    });
    return;
  }
  savingPrompt.value = true;
  try {
    const payload = {
      category_id: promptForm.value.category_id,
      title: promptForm.value.title.trim(),
      prompt: promptForm.value.prompt.trim(),
      image_urls: promptForm.value.image_urls,
      placeholders: promptForm.value.placeholders.filter((p) => p.key.trim()),
      sort_order: Number(promptForm.value.sort_order),
      is_active: Boolean(promptForm.value.is_active),
    };
    if (isEditingPrompt.value) {
      await $fetch(
        `/api/admin/prompt-library/prompts/${encodeURIComponent(promptForm.value.id)}`,
        { method: "PATCH", headers: authHeaders.value, body: payload },
      );
      toast.add({ title: "Prompt updated", color: "success" });
    } else {
      await $fetch("/api/admin/prompt-library/prompts", {
        method: "POST",
        headers: authHeaders.value,
        body: { id: promptForm.value.id.trim(), ...payload },
      });
      toast.add({ title: "Prompt created", color: "success" });
    }
    showPromptSlide.value = false;
    await fetchPrompts();
  } catch (err: unknown) {
    const raw = err as { data?: { message?: string }; message?: string };
    toast.add({
      title: "Save failed",
      description: raw?.data?.message ?? raw?.message,
      color: "error",
    });
  } finally {
    savingPrompt.value = false;
  }
}

async function deletePrompt(id: string) {
  deletingPrompt.value = id;
  try {
    await $fetch(
      `/api/admin/prompt-library/prompts/${encodeURIComponent(id)}`,
      { method: "DELETE", headers: authHeaders.value },
    );
    prompts.value = prompts.value.filter((p) => p.id !== id);
    toast.add({ title: "Prompt deleted", color: "success" });
  } catch {
    toast.add({ title: "Failed to delete prompt", color: "error" });
  } finally {
    deletingPrompt.value = null;
  }
}

function categoryName(id: string) {
  return categories.value.find((c) => c.id === id)?.name ?? id;
}

await Promise.all([fetchCategories(), fetchPrompts()]);
</script>

<template>
  <div class="space-y-10">
    <!-- ── Categories ── -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="font-semibold text-base">Categories</h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Group prompts by theme
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          size="sm"
          variant="outline"
          @click="openCreateCat"
        >
          Add Category
        </UButton>
      </div>

      <div v-if="loadingCats" class="flex justify-center py-10">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-primary"
        />
      </div>

      <div
        v-else-if="categories.length === 0"
        class="text-center py-10 text-zinc-400 text-sm"
      >
        No categories yet.
      </div>

      <div
        v-else
        class="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <table class="w-full text-sm">
          <thead>
            <tr
              class="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              <th class="text-left px-4 py-2.5">Category</th>
              <th class="text-left px-4 py-2.5 hidden md:table-cell">Color</th>
              <th class="text-left px-4 py-2.5 hidden md:table-cell">Icon</th>
              <th class="text-center px-4 py-2.5">Active</th>
              <th class="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
            <tr
              v-for="cat in categories"
              :key="cat.id"
              class="group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
              :class="!cat.is_active ? 'opacity-40' : ''"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div
                    :class="`size-7 rounded-lg bg-gradient-to-br ${cat.color} flex items-center justify-center flex-shrink-0`"
                  >
                    <UIcon :name="cat.icon" class="size-3.5 text-white" />
                  </div>
                  <div>
                    <p class="font-medium text-zinc-900 dark:text-zinc-100">
                      {{ cat.name }}
                    </p>
                    <p
                      class="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-[200px]"
                    >
                      {{ cat.description }}
                    </p>
                  </div>
                </div>
              </td>
              <td
                class="px-4 py-3 hidden md:table-cell font-mono text-xs text-zinc-400"
              >
                {{ cat.color }}
              </td>
              <td
                class="px-4 py-3 hidden md:table-cell font-mono text-xs text-zinc-400"
              >
                {{ cat.icon }}
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge
                  :color="cat.is_active ? 'success' : 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ cat.is_active ? "Active" : "Hidden" }}
                </UBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    icon="i-lucide-pencil"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="openEditCat(cat)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    size="xs"
                    :loading="deletingCat === cat.id"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="deleteCat(cat.id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Prompts ── -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="font-semibold text-base">Prompts</h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {{ prompts.length }} total prompts
          </p>
        </div>
        <div class="flex items-center gap-2">
          <select
            v-model="filterCategoryId"
            class="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All categories</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
          <UButton
            icon="i-lucide-plus"
            size="sm"
            variant="outline"
            @click="openCreatePrompt"
          >
            Add Prompt
          </UButton>
        </div>
      </div>

      <div v-if="loadingPrompts" class="flex justify-center py-10">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-primary"
        />
      </div>

      <div
        v-else-if="filteredPrompts.length === 0"
        class="text-center py-10 text-zinc-400 text-sm"
      >
        No prompts yet.
      </div>

      <div
        v-else
        class="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <table class="w-full text-sm">
          <thead>
            <tr
              class="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              <th class="text-left px-4 py-2.5">Prompt</th>
              <th class="text-left px-4 py-2.5 hidden md:table-cell">
                Category
              </th>
              <th class="text-center px-4 py-2.5 hidden md:table-cell">
                Images
              </th>
              <th class="text-center px-4 py-2.5">Active</th>
              <th class="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
            <tr
              v-for="p in filteredPrompts"
              :key="p.id"
              class="group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
              :class="!p.is_active ? 'opacity-40' : ''"
            >
              <td class="px-4 py-3">
                <p class="font-medium text-zinc-900 dark:text-zinc-100">
                  {{ p.title }}
                </p>
                <p
                  class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-xs truncate"
                >
                  {{ p.prompt }}
                </p>
              </td>
              <td
                class="px-4 py-3 hidden md:table-cell text-xs text-zinc-500 dark:text-zinc-400"
              >
                {{ categoryName(p.category_id) }}
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-center">
                <div
                  v-if="p.image_urls?.length"
                  class="flex items-center justify-center gap-1"
                >
                  <img
                    v-for="(url, i) in p.image_urls.slice(0, 3)"
                    :key="i"
                    :src="url"
                    class="size-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
                  />
                  <span
                    v-if="p.image_urls.length > 3"
                    class="text-xs text-zinc-400"
                    >+{{ p.image_urls.length - 3 }}</span
                  >
                </div>
                <span v-else class="text-xs text-zinc-300 dark:text-zinc-600"
                  >—</span
                >
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge
                  :color="p.is_active ? 'success' : 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ p.is_active ? "Active" : "Hidden" }}
                </UBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    icon="i-lucide-pencil"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="openEditPrompt(p)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    size="xs"
                    :loading="deletingPrompt === p.id"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="deletePrompt(p.id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Category Slideover ── -->
    <USlideover
      v-model:open="showCatSlide"
      :title="isEditingCat ? 'Edit Category' : 'Add Category'"
      side="right"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <div class="px-6 py-5 space-y-4">
          <UFormField label="Name" required>
            <UInput v-model="catForm.name" placeholder="Interior Design" />
          </UFormField>
          <UFormField label="ID" required hint="Auto-generated from name">
            <div class="flex items-center gap-2">
              <UInput
                v-model="catForm.id"
                :disabled="
                  !catIdEditable && !isEditingCat
                    ? true
                    : isEditingCat
                      ? true
                      : false
                "
                placeholder="kebab-case-id"
                class="flex-1 font-mono text-xs"
                :class="
                  (!catIdEditable && !isEditingCat) || isEditingCat
                    ? 'opacity-70'
                    : ''
                "
              />
              <button
                v-if="!isEditingCat"
                type="button"
                class="flex-shrink-0 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-primary hover:text-primary transition-colors"
                :class="
                  catIdEditable
                    ? 'border-primary text-primary bg-primary/5'
                    : 'text-zinc-400'
                "
                @click="catIdEditable = !catIdEditable"
              >
                <UIcon name="i-lucide-pencil" class="size-3.5" />
              </button>
            </div>
          </UFormField>
          <UFormField label="Description">
            <UTextarea
              v-model="catForm.description"
              placeholder="Short description"
              :rows="2"
            />
          </UFormField>
          <UFormField label="Icon" hint="Lucide icon name">
            <div class="flex items-center gap-2">
              <UInput
                v-model="catForm.icon"
                placeholder="i-lucide-home"
                class="font-mono text-xs flex-1"
              />
              <div
                class="size-9 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0"
              >
                <UIcon
                  :name="catForm.icon || 'i-lucide-sparkles'"
                  class="size-5"
                />
              </div>
            </div>
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Sort Order">
              <UInput
                v-model.number="catForm.sort_order"
                type="number"
                min="0"
              />
            </UFormField>
          </div>
          <label class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Active
              </p>
              <p class="text-xs text-zinc-400 dark:text-zinc-500">
                Visible in the prompt library
              </p>
            </div>
            <USwitch v-model="catForm.is_active" />
          </label>
        </div>
      </template>
      <template #footer>
        <div
          class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800"
        >
          <UButton variant="ghost" color="neutral" @click="showCatSlide = false"
            >Cancel</UButton
          >
          <UButton
            :loading="savingCat"
            :icon="isEditingCat ? 'i-lucide-save' : 'i-lucide-plus'"
            @click="saveCat"
          >
            {{ isEditingCat ? "Save Changes" : "Create Category" }}
          </UButton>
        </div>
      </template>
    </USlideover>

    <!-- ── Prompt Slideover ── -->
    <USlideover
      v-model:open="showPromptSlide"
      :title="isEditingPrompt ? 'Edit Prompt' : 'Add Prompt'"
      side="right"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #body>
        <div class="px-6 py-5 space-y-5 overflow-y-auto">
          <!-- Identity -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Identity
            </p>
            <UFormField label="Title" required>
              <UInput
                v-model="promptForm.title"
                placeholder="Cinematic Portrait"
              />
            </UFormField>
            <UFormField label="ID" required hint="Auto-generated from title">
              <div class="flex items-center gap-2">
                <UInput
                  v-model="promptForm.id"
                  :disabled="
                    (!promptIdEditable && !isEditingPrompt) || isEditingPrompt
                  "
                  placeholder="portrait-cinematic"
                  class="flex-1 font-mono text-xs"
                  :class="
                    (!promptIdEditable && !isEditingPrompt) || isEditingPrompt
                      ? 'opacity-70'
                      : ''
                  "
                />
                <button
                  v-if="!isEditingPrompt"
                  type="button"
                  class="flex-shrink-0 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-primary hover:text-primary transition-colors"
                  :class="
                    promptIdEditable
                      ? 'border-primary text-primary bg-primary/5'
                      : 'text-zinc-400'
                  "
                  @click="promptIdEditable = !promptIdEditable"
                >
                  <UIcon name="i-lucide-pencil" class="size-3.5" />
                </button>
              </div>
            </UFormField>
            <UFormField label="Category" required>
              <select
                v-model="promptForm.category_id"
                class="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-700 dark:text-zinc-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </UFormField>
          </div>

          <USeparator />

          <!-- Prompt text -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Content
            </p>
            <UFormField label="Prompt" class="w-full">
              <UTextarea
                v-model="promptForm.prompt"
                placeholder="Write the full prompt text here…"
                :rows="10"
                class="w-full"
              />
            </UFormField>
          </div>

          <USeparator />

          <!-- Placeholders -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p
                  class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
                >
                  Placeholders
                </p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  Use
                  <code
                    class="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded"
                    >&#123;&#123;key&#125;&#125;</code
                  >
                  in the prompt text to mark fill-in spots
                </p>
              </div>
              <UButton
                size="xs"
                variant="outline"
                color="neutral"
                icon="i-lucide-plus"
                @click="
                  promptForm.placeholders.push({ key: '', label: '', hint: '' })
                "
              >
                Add
              </UButton>
            </div>

            <div
              v-if="promptForm.placeholders.length === 0"
              class="text-xs text-zinc-400 dark:text-zinc-500 italic py-1"
            >
              No placeholders — prompt will be used as-is.
            </div>

            <div
              v-for="(ph, i) in promptForm.placeholders"
              :key="i"
              class="flex items-start gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40"
            >
              <div class="flex-1 space-y-2 min-w-0">
                <div class="grid grid-cols-3 gap-2">
                  <UFormField label="Key">
                    <UInput
                      v-model="ph.key"
                      placeholder="subject"
                      class="font-mono text-xs"
                      size="sm"
                    />
                  </UFormField>
                  <UFormField label="Label">
                    <UInput
                      v-model="ph.label"
                      placeholder="Subject"
                      size="sm"
                    />
                  </UFormField>
                  <UFormField label="Default">
                    <UInput
                      v-model="ph.default"
                      placeholder="Used when skipped"
                      size="sm"
                    />
                  </UFormField>
                </div>
                <UFormField
                  label="Options (one per line — leave empty for free text)"
                >
                  <UTextarea
                    :model-value="(ph.options ?? []).join('\n')"
                    placeholder="30cm silver beauty dish&#10;large octabox&#10;ring light"
                    :rows="3"
                    size="sm"
                    class="font-mono text-xs w-full"
                    @update:model-value="
                      (v: string) =>
                        (ph.options = v
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean))
                    "
                  />
                </UFormField>
              </div>
              <button
                type="button"
                class="mt-5 flex-shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                @click="promptForm.placeholders.splice(i, 1)"
              >
                <UIcon name="i-lucide-trash-2" class="size-3.5" />
              </button>
            </div>
          </div>

          <USeparator />

          <!-- Images -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Example Images
            </p>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="(url, i) in promptForm.image_urls"
                :key="i"
                class="relative group/img size-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
              >
                <img :src="url" class="w-full h-full object-cover" />
                <button
                  type="button"
                  class="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"
                  @click="removeImage(i)"
                >
                  <UIcon name="i-lucide-trash-2" class="size-4 text-white" />
                </button>
              </div>

              <button
                type="button"
                class="size-20 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center gap-1 text-zinc-400 dark:text-zinc-500 hover:border-primary hover:text-primary transition-colors flex-shrink-0"
                :class="uploadingImage ? 'pointer-events-none opacity-60' : ''"
                @click="imageInputRef?.click()"
              >
                <UIcon
                  v-if="!uploadingImage"
                  name="i-lucide-plus"
                  class="size-5"
                />
                <UIcon
                  v-else
                  name="i-lucide-loader-circle"
                  class="size-5 animate-spin"
                />
                <span class="text-[10px] font-medium">{{
                  uploadingImage ? "Uploading…" : "Add"
                }}</span>
              </button>

              <input
                ref="imageInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="handleImageSelect"
              />
            </div>
            <p class="text-xs text-zinc-400 dark:text-zinc-500">
              Each image generates a separate card in the library.
            </p>
          </div>

          <USeparator />

          <!-- Settings -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Settings
            </p>
            <UFormField label="Sort Order">
              <UInput
                v-model.number="promptForm.sort_order"
                type="number"
                min="0"
              />
            </UFormField>
            <label class="flex items-center justify-between cursor-pointer">
              <div>
                <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Active
                </p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500">
                  Show this prompt in the library
                </p>
              </div>
              <USwitch v-model="promptForm.is_active" />
            </label>
          </div>
        </div>
      </template>
      <template #footer>
        <div
          class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800"
        >
          <UButton
            variant="ghost"
            color="neutral"
            @click="showPromptSlide = false"
            >Cancel</UButton
          >
          <UButton
            :loading="savingPrompt"
            :icon="isEditingPrompt ? 'i-lucide-save' : 'i-lucide-plus'"
            @click="savePrompt"
          >
            {{ isEditingPrompt ? "Save Changes" : "Create Prompt" }}
          </UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
