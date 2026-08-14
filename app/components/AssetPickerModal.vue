<script setup lang="ts">
import type { PickedAsset } from "~/utils/assetPicker";
import { useGenerationService } from "~/services/generation.service";

const props = withDefaults(
  defineProps<{
    open: boolean;
    // "multi" allows selecting several images (image composer); "single" fills
    // one slot (video frame/reference).
    mode?: "multi" | "single";
    // Remaining slots available in multi mode. Ignored in single mode.
    maxSelect?: number;
    title?: string;
    // File types accepted by the device-upload tab. Defaults to images only.
    accept?: string;
  }>(),
  {
    mode: "single",
    maxSelect: 1,
    title: "Add an image",
    accept: "image/*",
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [assets: PickedAsset[]];
}>();

const supabase = useSupabaseClient();
const { user: authUser } = useAuthState();
const generationService = useGenerationService();
const toast = useToast();

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

type Tab = "uploads" | "generated" | "device";
const activeTab = ref<Tab>("uploads");

interface UploadAsset {
  key: string;
  url: string;
}
const uploads = ref<UploadAsset[]>([]);
const uploadsLoading = ref(false);
const uploadsLoaded = ref(false);

interface GeneratedAsset {
  id: string;
  url: string;
}
const generated = ref<GeneratedAsset[]>([]);
const generatedLoading = ref(false);
const generatedLoaded = ref(false);

// Selection state (shared across the URL-based tabs).
const selectedUrls = ref<string[]>([]);
// Device uploads awaiting confirmation, with object-URL previews.
interface PendingFile {
  file: File;
  previewUrl: string;
}
const pendingFiles = ref<PendingFile[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const isSingle = computed(() => props.mode === "single");
const limit = computed(() =>
  isSingle.value ? 1 : Math.max(1, props.maxSelect),
);
const selectedCount = computed(
  () => selectedUrls.value.length + pendingFiles.value.length,
);
const atLimit = computed(() => selectedCount.value >= limit.value);
const allowsVideo = computed(() => props.accept.includes("video"));
const fileNoun = computed(() => (allowsVideo.value ? "file" : "image"));
const fileNounPlural = computed(() => (allowsVideo.value ? "files" : "images"));

function isUrlSelected(url: string) {
  return selectedUrls.value.includes(url);
}

function toggleUrl(url: string) {
  if (isSingle.value) {
    // Replace any prior selection with this one.
    clearPendingFiles();
    selectedUrls.value = isUrlSelected(url) ? [] : [url];
    return;
  }
  if (isUrlSelected(url)) {
    selectedUrls.value = selectedUrls.value.filter((u) => u !== url);
  } else if (!atLimit.value) {
    selectedUrls.value = [...selectedUrls.value, url];
  } else {
    toast.add({
      title: `You can select up to ${limit.value} image${limit.value > 1 ? "s" : ""}`,
      color: "warning",
    });
  }
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadUploads() {
  if (uploadsLoaded.value) return;
  uploadsLoading.value = true;
  try {
    const headers = await authHeaders();
    const { assets } = await $fetch<{ assets: UploadAsset[] }>(
      "/api/assets/uploads",
      { headers },
    );
    uploads.value = assets ?? [];
    uploadsLoaded.value = true;
  } catch {
    toast.add({ title: "Failed to load your uploads", color: "error" });
  } finally {
    uploadsLoading.value = false;
  }
}

async function loadGenerated() {
  if (generatedLoaded.value || !authUser.value?.id) return;
  generatedLoading.value = true;
  try {
    const { data } = await generationService.getGenerationsByUser(
      authUser.value.id,
    );
    generated.value = (
      (data ?? []) as { id: string; output_image_url: string }[]
    )
      .filter((g) => !!g.output_image_url)
      .map((g) => ({ id: g.id, url: g.output_image_url }));
    generatedLoaded.value = true;
  } catch {
    toast.add({ title: "Failed to load your generations", color: "error" });
  } finally {
    generatedLoading.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === "uploads") loadUploads();
  else if (tab === "generated") loadGenerated();
});

// Device tab -----------------------------------------------------------------

function addFiles(files: File[]) {
  const accepted = files.filter(
    (f) =>
      f.type.startsWith("image/") ||
      (allowsVideo.value && f.type.startsWith("video/")),
  );
  for (const file of accepted) {
    if (isSingle.value) {
      clearPendingFiles();
      selectedUrls.value = [];
      pendingFiles.value = [{ file, previewUrl: URL.createObjectURL(file) }];
      break;
    }
    if (atLimit.value) {
      toast.add({
        title: `You can select up to ${limit.value} ${limit.value > 1 ? fileNounPlural.value : fileNoun.value}`,
        color: "warning",
      });
      break;
    }
    pendingFiles.value = [
      ...pendingFiles.value,
      { file, previewUrl: URL.createObjectURL(file) },
    ];
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  addFiles(Array.from(input.files ?? []));
  input.value = "";
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  addFiles(Array.from(e.dataTransfer?.files ?? []));
}

function removePendingFile(index: number) {
  const removed = pendingFiles.value[index];
  if (removed) URL.revokeObjectURL(removed.previewUrl);
  pendingFiles.value = pendingFiles.value.filter((_, i) => i !== index);
}

function clearPendingFiles() {
  for (const p of pendingFiles.value) URL.revokeObjectURL(p.previewUrl);
  pendingFiles.value = [];
}

// Confirm / reset -------------------------------------------------------------

function confirmSelection() {
  if (selectedCount.value === 0) return;
  const assets: PickedAsset[] = [
    ...selectedUrls.value.map((url) => ({ kind: "url" as const, url })),
    ...pendingFiles.value.map((p) => ({ kind: "file" as const, file: p.file })),
  ];
  emit("confirm", assets);
  isOpen.value = false;
}

function reset() {
  selectedUrls.value = [];
  clearPendingFiles();
  activeTab.value = "uploads";
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      reset();
      loadUploads();
    } else {
      clearPendingFiles();
    }
  },
);

onBeforeUnmount(clearPendingFiles);

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "uploads", label: "Your uploads", icon: "i-lucide-folder" },
  { id: "generated", label: "Generated", icon: "i-lucide-sparkles" },
  { id: "device", label: "Upload", icon: "i-lucide-upload" },
];
</script>

<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-2xl' }">
    <template #content>
      <div class="flex flex-col max-h-[80vh]">
        <!-- Header -->
        <div
          class="relative px-4 py-4 flex items-center justify-between flex-shrink-0"
        >
          <h3
            class="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5"
          >
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 flex-shrink-0"
            >
              <UIcon name="i-lucide-image-plus" class="size-[18px]" />
            </span>
            {{ title }}
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="-my-1"
            @click="isOpen = false"
          />
          <div
            class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />
        </div>

        <!-- Tabs -->
        <div class="flex items-center gap-1 px-4 pt-3 flex-shrink-0">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            :class="
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            "
            @click="activeTab = tab.id"
          >
            <UIcon :name="tab.icon" class="size-3.5" />
            {{ tab.label }}
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-4 min-h-[240px]">
          <!-- Uploads tab -->
          <template v-if="activeTab === 'uploads'">
            <div v-if="uploadsLoading" class="flex justify-center py-16">
              <UIcon
                name="i-lucide-loader-circle"
                class="size-6 animate-spin text-zinc-400"
              />
            </div>
            <p
              v-else-if="!uploads.length"
              class="text-center text-sm text-zinc-400 py-16"
            >
              You haven't uploaded any images yet.
            </p>
            <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                v-for="asset in uploads"
                :key="asset.key"
                type="button"
                class="relative aspect-square rounded-lg overflow-hidden border-2 transition-all group"
                :class="
                  isUrlSelected(asset.url)
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'
                "
                @click="toggleUrl(asset.url)"
              >
                <img
                  :src="asset.url"
                  alt=""
                  loading="lazy"
                  class="w-full h-full object-cover"
                />
                <div
                  v-if="isUrlSelected(asset.url)"
                  class="absolute inset-0 bg-primary/20 flex items-center justify-center"
                >
                  <span
                    class="size-6 rounded-full bg-primary text-white flex items-center justify-center"
                  >
                    <UIcon name="i-lucide-check" class="size-4" />
                  </span>
                </div>
              </button>
            </div>
          </template>

          <!-- Generated tab -->
          <template v-else-if="activeTab === 'generated'">
            <div v-if="generatedLoading" class="flex justify-center py-16">
              <UIcon
                name="i-lucide-loader-circle"
                class="size-6 animate-spin text-zinc-400"
              />
            </div>
            <p
              v-else-if="!generated.length"
              class="text-center text-sm text-zinc-400 py-16"
            >
              You don't have any generated images yet.
            </p>
            <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                v-for="asset in generated"
                :key="asset.id"
                type="button"
                class="relative aspect-square rounded-lg overflow-hidden border-2 transition-all group"
                :class="
                  isUrlSelected(asset.url)
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'
                "
                @click="toggleUrl(asset.url)"
              >
                <img
                  :src="asset.url"
                  alt=""
                  loading="lazy"
                  class="w-full h-full object-cover"
                />
                <div
                  v-if="isUrlSelected(asset.url)"
                  class="absolute inset-0 bg-primary/20 flex items-center justify-center"
                >
                  <span
                    class="size-6 rounded-full bg-primary text-white flex items-center justify-center"
                  >
                    <UIcon name="i-lucide-check" class="size-4" />
                  </span>
                </div>
              </button>
            </div>
          </template>

          <!-- Device tab -->
          <template v-else>
            <div
              class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
              :class="
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-primary/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              "
              @click="fileInput?.click()"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="onDrop"
            >
              <UIcon
                :name="
                  allowsVideo ? 'i-lucide-file-plus' : 'i-lucide-image-plus'
                "
                class="size-10 mx-auto mb-3 text-zinc-400 dark:text-zinc-500"
              />
              <p class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Drop {{ isSingle ? fileNoun : fileNounPlural }} here or
                <span class="text-primary">browse</span>
              </p>
              <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                {{
                  allowsVideo
                    ? "PNG, JPG, WEBP, MP4, MOV up to 10MB"
                    : "PNG, JPG, WEBP up to 10MB"
                }}
              </p>
              <input
                ref="fileInput"
                type="file"
                :accept="accept"
                :multiple="!isSingle"
                class="hidden"
                @change="onFileChange"
              />
            </div>

            <div
              v-if="pendingFiles.length"
              class="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4"
            >
              <div
                v-for="(pf, idx) in pendingFiles"
                :key="idx"
                class="relative aspect-square rounded-lg overflow-hidden border-2 border-primary ring-2 ring-primary/30"
              >
                <video
                  v-if="pf.file.type.startsWith('video/')"
                  :src="pf.previewUrl"
                  class="w-full h-full object-cover"
                  muted
                  playsinline
                />
                <img
                  v-else
                  :src="pf.previewUrl"
                  alt=""
                  class="w-full h-full object-cover"
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  @click="removePendingFile(idx)"
                >
                  <UIcon name="i-lucide-x" class="size-3" />
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex-shrink-0"
        >
          <span class="text-xs text-zinc-500 dark:text-zinc-400">
            <template v-if="isSingle">
              {{ selectedCount ? "1 selected" : "Select an image" }}
            </template>
            <template v-else>
              {{ selectedCount }} / {{ limit }} selected
            </template>
          </span>
          <div class="flex items-center gap-2">
            <UButton color="neutral" variant="ghost" @click="isOpen = false">
              Cancel
            </UButton>
            <UButton
              class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all disabled:!brightness-100 disabled:shadow-none"
              :disabled="selectedCount === 0"
              @click="confirmSelection"
            >
              Add {{ selectedCount || "" }}
              {{ selectedCount === 1 ? fileNoun : fileNounPlural }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
