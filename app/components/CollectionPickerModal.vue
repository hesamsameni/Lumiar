<script setup lang="ts">
import { useCollectionService } from "~/services/collection.service";

const props = defineProps<{
  open: boolean;
  generationId?: string;
  generationImageUrl?: string;
  // Bulk mode: pass multiple IDs instead of a single generationId
  generationIds?: string[];
  // Optional cover image URL to use when no cover is set yet (bulk mode)
  coverImageUrl?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:isSaved": [value: boolean];
}>();

const { user: authUser } = useAuthState();
const collectionService = useCollectionService();
const toast = useToast();
const collectionsVersion = useState("collectionsVersion", () => 0);

interface CollectionListItem {
  id: string;
  name: string;
  cover_image_url: string | null;
  collection_items: { generation_id: string }[];
}

const collections = ref<CollectionListItem[]>([]);
const memberSet = ref<Set<string>>(new Set());
const isLoading = ref(false);
const isToggling = ref<string | null>(null);

const showNewForm = ref(false);
const newName = ref("");
const isCreating = ref(false);
const newNameInput = ref<HTMLInputElement | null>(null);

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit("update:open", val),
});

async function load() {
  if (!authUser.value?.id) return;
  isLoading.value = true;
  try {
    const queries: [Promise<any>, Promise<any>?] = [
      collectionService.getCollectionsByUser(authUser.value.id),
    ];
    if (props.generationId) {
      queries.push(
        collectionService.getCollectionsForGeneration(props.generationId),
      );
    }
    const [{ data: cols }, membershipsRes] = await Promise.all(queries);
    collections.value = (cols ?? []) as CollectionListItem[];
    memberSet.value = new Set(
      membershipsRes
        ? (membershipsRes.data ?? []).map((m: any) => m.collection_id)
        : [],
    );
  } finally {
    isLoading.value = false;
  }
}

async function toggle(col: CollectionListItem) {
  // Bulk mode: add all IDs and close
  if (props.generationIds && props.generationIds.length > 0) {
    isToggling.value = col.id;
    try {
      const results = await Promise.allSettled(
        props.generationIds.map((id) =>
          collectionService.addToCollection(col.id, id),
        ),
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        toast.add({
          title: "Failed to add some images to collection",
          color: "error",
        });
      } else {
        // Set cover image if the collection has none
        const coverUrl = props.coverImageUrl ?? props.generationImageUrl;
        if (coverUrl && !col.cover_image_url) {
          await (useSupabaseClient().from("collections") as any)
            .update({ cover_image_url: coverUrl })
            .eq("id", col.id)
            .is("cover_image_url", null);
        }
        collectionsVersion.value++;
        toast.add({
          title: `Added ${props.generationIds.length} image${props.generationIds.length > 1 ? "s" : ""} to "${col.name}"`,
          color: "success",
        });
        isOpen.value = false;
      }
    } catch {
      toast.add({ title: "Failed to update collection", color: "error" });
    } finally {
      isToggling.value = null;
    }
    return;
  }
  isToggling.value = col.id;
  const removing = memberSet.value.has(col.id);
  try {
    const idx = collections.value.findIndex((c) => c.id === col.id);
    if (removing) {
      await collectionService.removeFromCollection(col.id, props.generationId);
      memberSet.value = new Set(
        [...memberSet.value].filter((id) => id !== col.id),
      );
      if (idx !== -1) {
        const existing = collections.value[idx]!;
        collections.value[idx] = {
          ...existing,
          collection_items: existing.collection_items.filter(
            (i) => i.generation_id !== props.generationId,
          ),
        };
      }
    } else {
      await collectionService.addToCollection(
        col.id,
        props.generationId!,
        props.generationImageUrl,
      );
      memberSet.value = new Set([...memberSet.value, col.id]);
      if (idx !== -1) {
        const existing = collections.value[idx]!;
        collections.value[idx] = {
          ...existing,
          collection_items: [
            ...existing.collection_items,
            { generation_id: props.generationId },
          ],
        };
      }
    }
    collectionsVersion.value++;
  } catch {
    toast.add({ title: "Failed to update collection", color: "error" });
  } finally {
    isToggling.value = null;
  }
}

async function createAndAdd() {
  if (!newName.value.trim() || !authUser.value?.id) return;
  isCreating.value = true;
  try {
    const { data, error } = await collectionService.createCollection({
      user_id: authUser.value.id,
      name: newName.value.trim(),
    });
    if (error) throw error;
    const col = data as CollectionListItem;
    col.collection_items = [];
    collections.value.unshift(col);
    await collectionService.addToCollection(
      col.id,
      props.generationId!,
      props.generationImageUrl,
    );
    memberSet.value = new Set([...memberSet.value, col.id]);
    const newIdx = collections.value.findIndex((c) => c.id === col.id);
    if (newIdx !== -1) {
      const existing = collections.value[newIdx]!;
      collections.value[newIdx] = {
        ...existing,
        cover_image_url:
          existing.cover_image_url ?? props.generationImageUrl ?? null,
        collection_items: [{ generation_id: props.generationId! }],
      };
    }
    collectionsVersion.value++;
    newName.value = "";
    showNewForm.value = false;
    toast.add({ title: `Added to "${col.name}"`, color: "success" });
  } catch {
    toast.add({ title: "Failed to create collection", color: "error" });
  } finally {
    isCreating.value = false;
  }
}

watch(memberSet, (set) => {
  emit("update:isSaved", set.size > 0);
});

watch(
  () => props.open,
  (val) => {
    if (val) {
      load();
      showNewForm.value = false;
      newName.value = "";
    }
  },
);

watch(showNewForm, (val) => {
  if (val) {
    nextTick(() => newNameInput.value?.focus());
  }
});
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div>
        <div
          class="relative px-4 py-4 flex items-center justify-between"
        >
          <h3
            class="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5"
          >
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 flex-shrink-0"
            >
              <UIcon name="i-lucide-folder" class="size-[18px]" />
            </span>
            Add to collection
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

        <div class="py-2 max-h-72 overflow-y-auto">
          <div v-if="isLoading" class="flex justify-center py-8">
            <UIcon
              name="i-lucide-loader-circle"
              class="size-5 animate-spin text-zinc-400"
            />
          </div>

          <template v-else>
            <p
              v-if="!collections.length && !showNewForm"
              class="px-4 py-6 text-center text-sm text-zinc-400"
            >
              No collections yet. Create your first one below.
            </p>

            <button
              v-for="col in collections"
              :key="col.id"
              class="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              :class="
                memberSet.has(col.id)
                  ? 'bg-gradient-to-r from-indigo-500/8 via-violet-500/6 to-fuchsia-500/8 hover:brightness-105'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
              "
              :disabled="isToggling === col.id"
              @click="toggle(col)"
            >
              <div
                class="size-10 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center"
              >
                <img
                  v-if="col.cover_image_url"
                  :src="col.cover_image_url"
                  class="w-full h-full object-cover"
                  alt=""
                />
                <UIcon
                  v-else
                  name="i-lucide-images"
                  class="size-4 text-zinc-400"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate"
                >
                  {{ col.name }}
                </p>
                <p class="text-xs text-zinc-400">
                  {{ col.collection_items.length }}
                  {{ col.collection_items.length === 1 ? "item" : "items" }}
                </p>
              </div>
              <UIcon
                v-if="isToggling === col.id"
                name="i-lucide-loader-circle"
                class="size-4 animate-spin text-zinc-400 flex-shrink-0"
              />
              <div
                v-else-if="memberSet.has(col.id)"
                class="flex items-center gap-1 flex-shrink-0"
              >
                <span class="text-xs font-semibold text-primary">Saved</span>
                <UIcon
                  name="i-lucide-check-circle-2"
                  class="size-4 text-primary"
                />
              </div>
              <UIcon
                v-else
                name="i-lucide-plus-circle"
                class="size-5 text-zinc-300 dark:text-zinc-600 flex-shrink-0"
              />
            </button>
          </template>
        </div>

        <div class="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
          <template v-if="showNewForm">
            <div class="flex gap-2">
              <input
                ref="newNameInput"
                v-model="newName"
                placeholder="Collection name"
                class="flex-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                @keyup.enter="createAndAdd"
                @keyup.escape="showNewForm = false"
              />
              <UButton
                size="sm"
                :loading="isCreating"
                :disabled="!newName.trim()"
                class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
                @click="createAndAdd"
              >
                Create
              </UButton>
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                :disabled="isCreating"
                @click="
                  showNewForm = false;
                  newName = '';
                "
              >
                Cancel
              </UButton>
            </div>
          </template>
          <template v-else>
            <UButton
              icon="i-lucide-folder-plus"
              size="sm"
              color="neutral"
              variant="ghost"
              class="w-full justify-start"
              @click="showNewForm = true"
            >
              New collection
            </UButton>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>
