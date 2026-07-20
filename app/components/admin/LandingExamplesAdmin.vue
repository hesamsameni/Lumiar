<script setup lang="ts">
import { USE_CASES } from "~/utils/useCases";

interface LandingExample {
  id: string;
  use_case_slug: string;
  image_url: string;
  caption: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const { session } = useAuthState();
const toast = useToast();

const items = ref<LandingExample[]>([]);
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const deleting = ref<string | null>(null);
const reordering = ref(false);

const selectedSlug = ref<string>(USE_CASES[0]!.slug);

const showSlide = ref(false);
const isEditing = ref(false);

type FormShape = {
  id: string;
  use_case_slug: string;
  image_url: string;
  caption: string;
  link_url: string;
  is_active: boolean;
};

const emptyForm = (): FormShape => ({
  id: "",
  use_case_slug: selectedSlug.value,
  image_url: "",
  caption: "",
  link_url: "",
  is_active: true,
});

const form = ref<FormShape>(emptyForm());
const fileInput = ref<HTMLInputElement | null>(null);

const authHeaders = computed(() => ({
  Authorization: `Bearer ${session.value?.access_token ?? ""}`,
}));

const selectedUseCase = computed(() =>
  USE_CASES.find((u) => u.slug === selectedSlug.value),
);

const itemsForSlug = computed(() =>
  items.value
    .filter((i) => i.use_case_slug === selectedSlug.value)
    .sort((a, b) => a.sort_order - b.sort_order),
);

function countForSlug(slug: string) {
  return items.value.filter((i) => i.use_case_slug === slug && i.is_active)
    .length;
}

async function fetchItems() {
  loading.value = true;
  try {
    const data = await $fetch<LandingExample[]>("/api/admin/landing-examples", {
      headers: authHeaders.value,
    });
    items.value = data ?? [];
  } catch {
    toast.add({ title: "Failed to load landing images", color: "error" });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = emptyForm();
  isEditing.value = false;
  showSlide.value = true;
}

function openEdit(item: LandingExample) {
  form.value = {
    id: item.id,
    use_case_slug: item.use_case_slug,
    image_url: item.image_url,
    caption: item.caption ?? "",
    link_url: item.link_url ?? "",
    is_active: item.is_active,
  };
  isEditing.value = true;
  showSlide.value = true;
}

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slug", form.value.use_case_slug);
    const { url } = await $fetch<{ url: string }>(
      "/api/admin/landing-examples/upload-image",
      { method: "POST", headers: authHeaders.value, body: fd },
    );
    form.value.image_url = url;
    toast.add({ title: "Image uploaded", color: "success" });
  } catch (err: unknown) {
    const raw = err as { data?: { message?: string }; message?: string };
    toast.add({
      title: "Upload failed",
      description: raw?.data?.message ?? raw?.message,
      color: "error",
    });
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}

async function save() {
  if (!form.value.image_url.trim()) {
    toast.add({ title: "Add an image (upload or URL) first", color: "warning" });
    return;
  }
  saving.value = true;
  try {
    if (isEditing.value) {
      await $fetch(`/api/admin/landing-examples/${form.value.id}`, {
        method: "PATCH",
        headers: authHeaders.value,
        body: {
          image_url: form.value.image_url.trim(),
          caption: form.value.caption.trim() || null,
          link_url: form.value.link_url.trim() || null,
          is_active: form.value.is_active,
          use_case_slug: form.value.use_case_slug,
        },
      });
      toast.add({ title: "Image updated", color: "success" });
    } else {
      const nextSort =
        itemsForSlug.value.length > 0
          ? Math.max(...itemsForSlug.value.map((i) => i.sort_order)) + 1
          : 0;
      await $fetch("/api/admin/landing-examples", {
        method: "POST",
        headers: authHeaders.value,
        body: {
          use_case_slug: form.value.use_case_slug,
          image_url: form.value.image_url.trim(),
          caption: form.value.caption.trim() || null,
          link_url: form.value.link_url.trim() || null,
          is_active: form.value.is_active,
          sort_order: nextSort,
        },
      });
      toast.add({ title: "Image added", color: "success" });
    }
    showSlide.value = false;
    await fetchItems();
  } catch (err: unknown) {
    const raw = err as { data?: { message?: string }; message?: string };
    toast.add({
      title: "Save failed",
      description: raw?.data?.message ?? raw?.message,
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

async function toggleActive(item: LandingExample) {
  const next = !item.is_active;
  try {
    await $fetch(`/api/admin/landing-examples/${item.id}`, {
      method: "PATCH",
      headers: authHeaders.value,
      body: { is_active: next },
    });
    item.is_active = next;
  } catch {
    toast.add({ title: "Failed to update", color: "error" });
  }
}

async function remove(id: string): Promise<boolean> {
  deleting.value = id;
  try {
    await $fetch(`/api/admin/landing-examples/${id}`, {
      method: "DELETE",
      headers: authHeaders.value,
    });
    items.value = items.value.filter((i) => i.id !== id);
    toast.add({ title: "Image removed", color: "success" });
    return true;
  } catch {
    toast.add({ title: "Failed to delete", color: "error" });
    return false;
  } finally {
    deleting.value = null;
  }
}

const showDeleteModal = ref(false);
const pendingDelete = ref<LandingExample | null>(null);

function requestDelete(item: LandingExample) {
  pendingDelete.value = item;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!pendingDelete.value) return;
  const ok = await remove(pendingDelete.value.id);
  if (ok) {
    showDeleteModal.value = false;
    pendingDelete.value = null;
  }
}

async function move(item: LandingExample, direction: -1 | 1) {
  const list = itemsForSlug.value;
  const idx = list.findIndex((i) => i.id === item.id);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= list.length) return;
  const other = list[swapIdx]!;

  reordering.value = true;
  const a = item.sort_order;
  const b = other.sort_order;
  // Optimistic swap
  item.sort_order = b;
  other.sort_order = a;
  try {
    await Promise.all([
      $fetch(`/api/admin/landing-examples/${item.id}`, {
        method: "PATCH",
        headers: authHeaders.value,
        body: { sort_order: b },
      }),
      $fetch(`/api/admin/landing-examples/${other.id}`, {
        method: "PATCH",
        headers: authHeaders.value,
        body: { sort_order: a },
      }),
    ]);
  } catch {
    item.sort_order = a;
    other.sort_order = b;
    toast.add({ title: "Failed to reorder", color: "error" });
  } finally {
    reordering.value = false;
  }
}

onMounted(fetchItems);
</script>

<template>
  <div>
    <!-- Info banner -->
    <div
      class="mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-indigo-500/8 via-violet-500/5 to-transparent px-4 py-3"
    >
      <UIcon
        name="i-lucide-info"
        class="size-4 text-primary mt-0.5 flex-shrink-0"
      />
      <p class="text-sm text-zinc-600 dark:text-zinc-300">
        Curate the example images shown on each
        <span class="font-medium">/ai</span> landing page. When a page has no
        active images here, it automatically falls back to community images
        pulled by tag.
      </p>
    </div>

    <!-- Use-case selector -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="uc in USE_CASES"
        :key="uc.slug"
        type="button"
        class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all"
        :class="
          selectedSlug === uc.slug
            ? 'border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary font-medium ring-1 ring-primary/20'
            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
        "
        @click="selectedSlug = uc.slug"
      >
        <UIcon :name="`i-lucide-${uc.icon}`" class="size-3.5" />
        {{ uc.label }}
        <span
          class="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold"
          :class="
            countForSlug(uc.slug) > 0
              ? 'bg-primary/15 text-primary'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
          "
        >
          {{ countForSlug(uc.slug) }}
        </span>
      </button>
    </div>

    <!-- Header row -->
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-2 min-w-0">
        <p class="text-sm text-zinc-500 dark:text-zinc-400 truncate">
          <span class="font-medium text-zinc-700 dark:text-zinc-300">{{
            selectedUseCase?.heading
          }}</span>
          <span class="mx-1.5">·</span>
          <a
            :href="`/ai/${selectedSlug}`"
            target="_blank"
            rel="noopener"
            class="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            /ai/{{ selectedSlug }}
            <UIcon name="i-lucide-external-link" class="size-3" />
          </a>
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        size="sm"
        class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all flex-shrink-0"
        @click="openCreate"
      >
        Add Image
      </UButton>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <template v-else>
      <!-- Empty -->
      <div
        v-if="itemsForSlug.length === 0"
        class="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800"
      >
        <UIcon name="i-lucide-image-off" class="size-10" />
        <p class="text-sm">No curated images for this page.</p>
        <p class="text-xs text-zinc-400 dark:text-zinc-500 max-w-xs text-center">
          It currently shows auto-selected community images by the
          <span class="font-mono">{{ selectedUseCase?.exampleTag }}</span> tag.
        </p>
        <UButton
          variant="outline"
          size="sm"
          icon="i-lucide-plus"
          @click="openCreate"
        >
          Add your first image
        </UButton>
      </div>

      <!-- Grid -->
      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
        :class="reordering ? 'opacity-70 pointer-events-none' : ''"
      >
        <div
          v-for="(item, idx) in itemsForSlug"
          :key="item.id"
          class="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900"
          :class="!item.is_active ? 'opacity-50' : ''"
        >
          <div class="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
            <img
              :src="item.image_url"
              :alt="item.caption ?? 'Landing example'"
              class="w-full h-full object-cover"
            />
            <!-- Reorder controls -->
            <div class="absolute top-2 left-2 flex flex-col gap-1">
              <button
                type="button"
                :disabled="idx === 0"
                class="size-6 rounded-md bg-black/50 text-white flex items-center justify-center hover:bg-black/70 disabled:opacity-30 backdrop-blur"
                title="Move up"
                @click="move(item, -1)"
              >
                <UIcon name="i-lucide-arrow-up" class="size-3.5" />
              </button>
              <button
                type="button"
                :disabled="idx === itemsForSlug.length - 1"
                class="size-6 rounded-md bg-black/50 text-white flex items-center justify-center hover:bg-black/70 disabled:opacity-30 backdrop-blur"
                title="Move down"
                @click="move(item, 1)"
              >
                <UIcon name="i-lucide-arrow-down" class="size-3.5" />
              </button>
            </div>
            <!-- Position badge -->
            <span
              class="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-black/50 text-white backdrop-blur"
            >
              #{{ idx + 1 }}
            </span>
          </div>

          <div class="p-3">
            <p
              class="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 min-h-[2rem]"
            >
              {{ item.caption || "No caption" }}
            </p>
            <div
              class="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800"
            >
              <USwitch
                :model-value="item.is_active"
                size="xs"
                @update:model-value="toggleActive(item)"
              />
              <div class="flex items-center gap-1">
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  @click="openEdit(item)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  color="error"
                  size="xs"
                  :loading="deleting === item.id"
                  aria-label="Delete image"
                  @click="requestDelete(item)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <ConfirmModal
      v-model:open="showDeleteModal"
      title="Remove landing image"
      :description="`Remove this image from “${selectedUseCase?.heading ?? 'landing page'}”? This cannot be undone.`"
      confirm-text="Remove"
      confirm-color="error"
      icon="i-lucide-trash-2"
      :loading="!!deleting"
      @confirm="confirmDelete"
    />

    <!-- Add / Edit slideover -->
    <USlideover
      v-model:open="showSlide"
      :title="isEditing ? 'Edit Image' : 'Add Image'"
      :description="`For ${selectedUseCase?.heading}`"
      side="right"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <div class="px-6 py-5 space-y-6 overflow-y-auto">
          <!-- Image -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Image
            </p>
            <div
              class="relative aspect-video rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 overflow-hidden bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center"
            >
              <img
                v-if="form.image_url"
                :src="form.image_url"
                alt="Preview"
                class="w-full h-full object-contain"
              />
              <div
                v-else
                class="text-center text-zinc-400 dark:text-zinc-500 text-xs px-4"
              >
                <UIcon name="i-lucide-image" class="size-8 mx-auto mb-2" />
                Upload a file or paste an image URL
              </div>
            </div>
            <div class="flex gap-2">
              <UButton
                :loading="uploading"
                icon="i-lucide-upload"
                variant="outline"
                color="neutral"
                size="sm"
                class="flex-1"
                @click="fileInput?.click()"
              >
                Upload
              </UButton>
              <input
                ref="fileInput"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="hidden"
                @change="onFileChange"
              />
            </div>
            <UFormField label="Or paste an image URL">
              <UInput
                v-model="form.image_url"
                placeholder="https://…"
                class="font-mono text-xs"
              />
            </UFormField>
          </div>

          <USeparator />

          <!-- Details -->
          <div class="space-y-3">
            <p
              class="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
            >
              Details
            </p>
            <UFormField label="Caption" hint="Shown on hover · used as alt text">
              <UTextarea
                v-model="form.caption"
                :rows="2"
                placeholder="e.g. Professional studio headshot"
              />
            </UFormField>
            <UFormField label="Link URL" hint="Optional · where the image links">
              <UInput
                v-model="form.link_url"
                placeholder="/generation/… or https://…"
                class="font-mono text-xs"
              />
            </UFormField>
            <label class="flex items-center justify-between cursor-pointer pt-1">
              <div>
                <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Active
                </p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500">
                  Visible on the landing page
                </p>
              </div>
              <USwitch v-model="form.is_active" />
            </label>
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
            @click="save"
          >
            {{ isEditing ? "Save Changes" : "Add Image" }}
          </UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
