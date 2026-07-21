<script setup lang="ts">
/**
 * Pick an image from the user's library (generated / previously uploaded)
 * or upload a new one from the device. Used by image + video composers.
 */
export type MediaPickerTab = "generated" | "uploaded" | "device";

export type MediaPickerResult =
  | { source: "device"; files: File[] }
  | { source: "library"; urls: string[] };

interface LibraryItem {
  id: string;
  url: string;
  label: string;
  createdAt: string;
}

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** Max images selectable from the library (device multi follows same cap). */
    maxSelect?: number;
    title?: string;
  }>(),
  {
    maxSelect: 1,
    title: "Choose an image",
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  select: [result: MediaPickerResult];
}>();

const { user: authUser } = useAuthState();
const supabase = useSupabaseClient();

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit("update:open", val),
});

const activeTab = ref<MediaPickerTab>("generated");
const isLoading = ref(false);
const generated = ref<LibraryItem[]>([]);
const uploaded = ref<LibraryItem[]>([]);
const selected = ref<Set<string>>(new Set());
const deviceInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const maxSelect = computed(() => Math.max(1, props.maxSelect ?? 1));
const multi = computed(() => maxSelect.value > 1);

watch(
  () => props.open,
  async (val) => {
    if (!val) return;
    activeTab.value = "generated";
    selected.value = new Set();
    isDragging.value = false;
    await loadLibrary();
  },
);

async function loadLibrary() {
  if (!authUser.value?.id) {
    generated.value = [];
    uploaded.value = [];
    return;
  }
  isLoading.value = true;
  try {
    const userId = authUser.value.id;
    const [gensRes, vidsRes] = await Promise.all([
      supabase
        .from("generations")
        .select("id, output_image_url, input_image_url, prompt, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("video_generations")
        .select(
          "id, input_image_url, thumbnail_url, metadata, prompt, created_at, status",
        )
        .eq("user_id", userId)
        .neq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    const gens = (gensRes.data ?? []) as {
      id: string;
      output_image_url: string | null;
      input_image_url: string | null;
      prompt: string | null;
      metadata: {
        input_image_urls?: string[];
        first_frame_url?: string;
        last_frame_url?: string;
        reference_url?: string;
      } | null;
      created_at: string;
    }[];

    const vids = (vidsRes.data ?? []) as {
      id: string;
      input_image_url: string | null;
      thumbnail_url: string | null;
      prompt: string | null;
      metadata: {
        first_frame_url?: string;
        last_frame_url?: string;
        reference_url?: string;
      } | null;
      created_at: string;
    }[];

    generated.value = gens
      .filter((g) => !!g.output_image_url)
      .map((g) => ({
        id: `gen-${g.id}`,
        url: g.output_image_url!,
        label: g.prompt?.trim() || "Generated image",
        createdAt: g.created_at,
      }));

    // Dedup uploaded / reference assets by URL.
    const uploadMap = new Map<string, LibraryItem>();
    function addUpload(url: string | null | undefined, id: string, label: string, createdAt: string) {
      if (!url || uploadMap.has(url)) return;
      // Skip outputs that already appear in Generated.
      if (generated.value.some((g) => g.url === url)) return;
      uploadMap.set(url, { id, url, label, createdAt });
    }

    for (const g of gens) {
      addUpload(g.input_image_url, `up-gen-${g.id}`, "Uploaded reference", g.created_at);
      for (const [i, url] of (g.metadata?.input_image_urls ?? []).entries()) {
        addUpload(url, `up-gen-${g.id}-${i}`, "Uploaded reference", g.created_at);
      }
    }
    for (const v of vids) {
      addUpload(
        v.input_image_url,
        `up-vid-${v.id}`,
        "Video input",
        v.created_at,
      );
      addUpload(
        v.metadata?.first_frame_url,
        `up-vid-${v.id}-first`,
        "First frame",
        v.created_at,
      );
      addUpload(
        v.metadata?.last_frame_url,
        `up-vid-${v.id}-last`,
        "Last frame",
        v.created_at,
      );
      addUpload(
        v.metadata?.reference_url,
        `up-vid-${v.id}-ref`,
        "Reference",
        v.created_at,
      );
      // Video thumbnails are useful stills for image-to-video.
      addUpload(
        v.thumbnail_url,
        `up-vid-${v.id}-thumb`,
        v.prompt?.trim() || "Video thumbnail",
        v.created_at,
      );
    }

    uploaded.value = [...uploadMap.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  } finally {
    isLoading.value = false;
  }
}

function toggleSelect(url: string) {
  // Single-select: pick immediately (video slots, one reference).
  if (!multi.value) {
    emit("select", { source: "library", urls: [url] });
    isOpen.value = false;
    return;
  }
  const next = new Set(selected.value);
  if (next.has(url)) {
    next.delete(url);
  } else {
    if (next.size >= maxSelect.value) return;
    next.add(url);
  }
  selected.value = next;
}

function confirmLibrary() {
  const urls = [...selected.value];
  if (!urls.length) return;
  emit("select", { source: "library", urls });
  isOpen.value = false;
}

function pickDevice() {
  deviceInput.value?.click();
}

function onDeviceChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []).filter(
    (f) => f.type.startsWith("image/"),
  );
  (e.target as HTMLInputElement).value = "";
  if (!files.length) return;
  emit("select", {
    source: "device",
    files: files.slice(0, maxSelect.value),
  });
  isOpen.value = false;
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
    f.type.startsWith("image/"),
  );
  if (!files.length) return;
  emit("select", {
    source: "device",
    files: files.slice(0, maxSelect.value),
  });
  isOpen.value = false;
}

const currentItems = computed(() =>
  activeTab.value === "generated" ? generated.value : uploaded.value,
);

const tabs: { id: MediaPickerTab; label: string; icon: string }[] = [
  { id: "generated", label: "Generated", icon: "i-lucide-sparkles" },
  { id: "uploaded", label: "Uploaded", icon: "i-lucide-images" },
  { id: "device", label: "Device", icon: "i-lucide-upload" },
];
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="flex flex-col max-h-[min(85vh,720px)]">
        <!-- Header -->
        <div class="relative px-4 py-4 flex items-center justify-between flex-shrink-0">
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
        <div class="px-4 pt-3 flex-shrink-0">
          <div
            class="flex items-center gap-0.5 p-1 rounded-full bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 w-fit max-w-full overflow-x-auto"
          >
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              :class="
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              "
              @click="activeTab = tab.id"
            >
              <UIcon
                :name="tab.icon"
                class="size-3.5"
                :class="activeTab === tab.id ? 'text-primary' : ''"
              />
              {{ tab.label }}
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <!-- Device tab -->
          <div
            v-if="activeTab === 'device'"
            class="flex flex-col items-center justify-center min-h-[280px] rounded-2xl border-2 border-dashed transition-colors"
            :class="
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-zinc-200 dark:border-zinc-700'
            "
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
            @drop.prevent="onDrop"
          >
            <span
              class="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 mb-3"
            >
              <UIcon name="i-lucide-upload" class="size-5" />
            </span>
            <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
              Upload from your device
            </p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-4 text-center px-6">
              Drag & drop{{ multi ? " images" : " an image" }} here, or browse
              files
            </p>
            <UButton
              icon="i-lucide-folder-open"
              class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
              @click="pickDevice"
            >
              Browse files
            </UButton>
            <input
              id="media-picker-device-input"
              ref="deviceInput"
              type="file"
              accept="image/*"
              class="hidden"
              aria-label="Upload images from device"
              :multiple="multi"
              @change="onDeviceChange"
            />
          </div>

          <!-- Library tabs -->
          <template v-else>
            <div v-if="isLoading" class="flex justify-center py-16">
              <UIcon
                name="i-lucide-loader-circle"
                class="size-6 animate-spin text-primary"
              />
            </div>

            <div
              v-else-if="!currentItems.length"
              class="flex flex-col items-center justify-center min-h-[280px] text-center px-6"
            >
              <UIcon
                :name="
                  activeTab === 'generated'
                    ? 'i-lucide-sparkles'
                    : 'i-lucide-images'
                "
                class="size-8 text-zinc-300 dark:text-zinc-600 mb-3"
              />
              <p class="text-sm text-zinc-500 dark:text-zinc-400">
                {{
                  activeTab === "generated"
                    ? "No generated images yet. Create one, or upload from your device."
                    : "No uploaded references yet. They appear here after you use images in a generation."
                }}
              </p>
              <UButton
                variant="outline"
                color="neutral"
                size="sm"
                class="mt-4"
                icon="i-lucide-upload"
                @click="activeTab = 'device'"
              >
                Upload from device
              </UButton>
            </div>

            <div
              v-else
              class="grid grid-cols-3 sm:grid-cols-4 gap-2"
            >
              <button
                v-for="item in currentItems"
                :key="item.id"
                type="button"
                class="relative aspect-square rounded-xl overflow-hidden border-2 transition-all group"
                :class="
                  selected.has(item.url)
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'
                "
                :title="item.label"
                @click="toggleSelect(item.url)"
              >
                <img
                  :src="item.url"
                  :alt="item.label"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div
                  class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"
                />
                <span
                  v-if="selected.has(item.url)"
                  class="absolute top-1.5 right-1.5 size-5 rounded-full bg-gradient-brand text-white flex items-center justify-center shadow"
                >
                  <UIcon name="i-lucide-check" class="size-3" />
                </span>
              </button>
            </div>
          </template>
        </div>

        <!-- Footer (multi library select only — single-select confirms on click) -->
        <div
          v-if="activeTab !== 'device' && multi"
          class="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex-shrink-0"
        >
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <template v-if="multi">
              {{ selected.size }} / {{ maxSelect }} selected
            </template>
            <template v-else>
              {{ selected.size ? "1 selected" : "Select an image" }}
            </template>
          </p>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              @click="isOpen = false"
            >
              Cancel
            </UButton>
            <UButton
              size="sm"
              :disabled="!selected.size"
              class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all disabled:shadow-none"
              @click="confirmLibrary"
            >
              Use selected
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
