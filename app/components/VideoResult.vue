<script setup lang="ts">
import { useVideoGenerationService } from "~/services/videoGeneration.service";
import { downloadImageToDevice } from "~/utils/download";

const props = defineProps<{
  videoUrl: string;
  thumbnailUrl: string;
  generationId: string;
  prompt: string;
}>();

const emit = defineEmits<{
  deleted: [];
  startOver: [];
}>();

const { session } = useAuthState();
const videoService = useVideoGenerationService();
const toast = useToast();
const posthog = usePostHog();
const isSaving = ref(false);
const isShared = ref(false);
const showCollectionPicker = ref(false);
const isSavedToCollection = ref(false);
const isDeleting = ref(false);
const showDeleteModal = ref(false);

async function deleteGeneration() {
  isDeleting.value = true;
  try {
    await $fetch(`/api/video-generations/${props.generationId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.value?.access_token ?? ""}` },
    });
    toast.add({ title: "Video deleted", color: "success" });
    emit("deleted");
  } catch {
    toast.add({ title: "Failed to delete video", color: "error" });
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

async function downloadVideo() {
  await downloadImageToDevice(props.videoUrl, `lumiar-${props.generationId}.mp4`);
}

function remix() {
  posthog?.capture("video_remixed", {
    generation_id: props.generationId,
    source: "result",
  });
  navigateTo({ path: "/video", query: { prompt: props.prompt } });
}

async function toggleShare() {
  isSaving.value = true;
  try {
    const { error } = await videoService.setVideoShared(
      props.generationId,
      !isShared.value,
    );
    if (error) throw error;
    isShared.value = !isShared.value;
    toast.add({
      title: isShared.value ? "Shared to Explore!" : "Removed from Explore",
      color: "success",
    });
  } catch {
    toast.add({ title: "Failed to update sharing", color: "error" });
  } finally {
    isSaving.value = false;
  }
}

// ─── Share helpers ────────────────────────────────────────────────────────────

const generationUrl = computed(() => {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.lumiar.site";
  return `${base}/video/${props.generationId}`;
});

async function ensureExploreShared() {
  if (isShared.value) return;
  const { error } = await videoService.setVideoShared(props.generationId, true);
  if (!error) {
    isShared.value = true;
    toast.add({
      title: "Your video is now public on Explore too",
      icon: "i-lucide-globe",
      color: "success",
    });
  }
}

async function copyLink() {
  await ensureExploreShared();
  await navigator.clipboard.writeText(generationUrl.value);
  toast.add({ title: "Link copied!", icon: "i-lucide-link", color: "success" });
}

async function shareOnX() {
  await ensureExploreShared();
  const text = `✨ AI video I made with Lumiar → ${generationUrl.value} #AIvideo #lumiar`;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer,width=550,height=420",
  );
}

async function shareOnWhatsApp() {
  await ensureExploreShared();
  const text = `✨ AI video I made with Lumiar → ${generationUrl.value} #AIvideo #lumiar`;
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

async function shareOnTelegram() {
  await ensureExploreShared();
  const text = `✨ AI video I made with Lumiar #AIvideo #lumiar`;
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(generationUrl.value)}&text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

// ─── 3-dot menu items ─────────────────────────────────────────────────────────

const moreMenuItems = computed(() => [
  [
    {
      label: "View details",
      icon: "i-lucide-arrow-up-right",
      onSelect: () => navigateTo(`/video/${props.generationId}`),
    },
  ],
  [
    { label: "Copy link", icon: "i-lucide-link", onSelect: copyLink },
    { label: "Share on X", icon: "i-lucide-external-link", onSelect: shareOnX },
    {
      label: "Share on WhatsApp",
      icon: "i-lucide-message-circle",
      onSelect: shareOnWhatsApp,
    },
    {
      label: "Share on Telegram",
      icon: "i-lucide-send",
      onSelect: shareOnTelegram,
    },
  ],
  [
    {
      label: isDeleting.value ? "Deleting…" : "Delete",
      icon: "i-lucide-trash-2",
      color: "error" as const,
      disabled: isDeleting.value,
      onSelect: () => {
        showDeleteModal.value = true;
      },
    },
  ],
]);
</script>

<template>
  <!-- Ready divider -->
  <div class="flex items-center gap-3 mb-5 mt-5">
    <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    <span
      class="flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500 select-none"
    >
      <UIcon name="i-lucide-clapperboard" class="size-3 text-primary" />
      Your video is ready
    </span>
    <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
  </div>

  <!-- Result card -->
  <div
    class="animate-fade-up rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-200/60 dark:shadow-black/40"
  >
    <!-- Video -->
    <div class="relative bg-zinc-950">
      <video
        :src="videoUrl"
        :poster="thumbnailUrl || undefined"
        controls
        autoplay
        muted
        loop
        playsinline
        class="w-full max-h-[70vh] object-contain"
      />
    </div>

    <!-- Actions panel -->
    <div
      class="p-4 sm:p-5 space-y-3 border-t border-zinc-100 dark:border-zinc-800"
    >
      <!-- Prompt -->
      <p
        class="text-xs text-zinc-500 dark:text-zinc-400 italic line-clamp-2 leading-relaxed"
        :style="rtlStyle(prompt)"
        :dir="hasRtlChars(prompt) ? 'rtl' : 'ltr'"
      >
        "{{ prompt }}"
      </p>

      <!-- Primary actions -->
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-download"
          size="sm"
          class="flex-1 !bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
          @click="downloadVideo"
        >
          Download
        </UButton>
        <UButton
          icon="i-lucide-shuffle"
          size="sm"
          variant="outline"
          color="neutral"
          class="flex-1"
          title="Start a new video from this prompt"
          @click="remix"
        >
          Remix
        </UButton>
      </div>

      <!-- Secondary actions -->
      <div
        class="flex items-center gap-1 pt-2 border-t border-zinc-100 dark:border-zinc-800"
      >
        <UButton
          :icon="isShared ? 'i-lucide-eye-off' : 'i-lucide-globe'"
          size="xs"
          :variant="isShared ? 'soft' : 'ghost'"
          color="primary"
          :loading="isSaving"
          @click="toggleShare"
        >
          {{ isShared ? "Unshare" : "Share to Explore" }}
        </UButton>
        <UButton
          :icon="
            isSavedToCollection
              ? 'i-lucide-folder-check'
              : 'i-lucide-folder-plus'
          "
          size="xs"
          :variant="isSavedToCollection ? 'soft' : 'ghost'"
          :color="isSavedToCollection ? 'primary' : 'neutral'"
          @click="showCollectionPicker = true"
        >
          {{ isSavedToCollection ? "Saved" : "Collection" }}
        </UButton>

        <div class="ml-auto">
          <UDropdownMenu
            :items="moreMenuItems"
            :popper="{ placement: 'bottom-end' }"
          >
            <UButton
              icon="i-lucide-ellipsis"
              size="xs"
              variant="ghost"
              color="neutral"
            />
          </UDropdownMenu>
        </div>
      </div>
    </div>
  </div>

  <!-- Start Over -->
  <div class="mt-4 flex justify-center">
    <UButton
      icon="i-lucide-rotate-ccw"
      size="sm"
      variant="ghost"
      color="neutral"
      @click="emit('startOver')"
    >
      Start Over
    </UButton>
  </div>

  <CollectionPickerModal
    v-model:open="showCollectionPicker"
    v-model:is-saved="isSavedToCollection"
    :generation-id="generationId"
    :generation-image-url="thumbnailUrl || undefined"
    media-type="video"
  />

  <ConfirmModal
    v-model:open="showDeleteModal"
    title="Delete Video"
    description="Are you sure you want to delete this video? This action cannot be undone."
    confirm-text="Delete"
    confirm-color="error"
    icon="i-lucide-trash-2"
    :loading="isDeleting"
    @confirm="deleteGeneration"
  />
</template>
