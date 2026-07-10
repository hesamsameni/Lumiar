<script setup lang="ts">
import { useGenerationService } from "~/services/generation.service";

const props = defineProps<{
  generationId: string;
  imageUrl: string;
  prompt: string;
  isShared: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "outline" | "soft" | "ghost" | "link";
}>();

const emit = defineEmits<{
  sharedToExplore: [];
}>();

const generationService = useGenerationService();
const toast = useToast();
const isProcessing = ref(false);
const internalIsShared = ref(props.isShared);
const showConfirmModal = ref(false);
const dontShowAgain = ref(false);
const pendingAction = ref<(() => Promise<void>) | null>(null);

watch(
  () => props.isShared,
  (v) => {
    internalIsShared.value = v;
  },
);

const SUPPRESS_KEY = "lumiar_share_explore_suppress";

function isSuppressed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SUPPRESS_KEY) === "true";
}

function withExploreCheck(fn: () => Promise<void>) {
  if (internalIsShared.value || isSuppressed()) {
    fn();
    return;
  }
  pendingAction.value = fn;
  showConfirmModal.value = true;
}

async function handleModalConfirm() {
  if (dontShowAgain.value) localStorage.setItem(SUPPRESS_KEY, "true");
  showConfirmModal.value = false;
  await pendingAction.value?.();
  pendingAction.value = null;
}

function handleModalCancel() {
  showConfirmModal.value = false;
  pendingAction.value = null;
  dontShowAgain.value = false;
}

const generationUrl = computed(() => {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.lumiar.site";
  return `${base}/generation/${props.generationId}`;
});

const canWebShare = computed(() => {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.share === "function";
});

async function ensureExploreShared() {
  if (internalIsShared.value) return;
  const { error } = await generationService.setGenerationShared(
    props.generationId,
    true,
  );
  if (!error) {
    internalIsShared.value = true;
    emit("sharedToExplore");
    toast.add({
      title: "Your image is now public on Explore too",
      icon: "i-lucide-globe",
      color: "success",
    });
  }
}

async function copyLink() {
  isProcessing.value = true;
  try {
    await ensureExploreShared();
    await navigator.clipboard.writeText(generationUrl.value);
    toast.add({
      title: "Link copied!",
      icon: "i-lucide-link",
      color: "success",
    });
  } finally {
    isProcessing.value = false;
  }
}

async function shareOnX() {
  await ensureExploreShared();
  const text = `✨ AI art I made with Lumiar → ${generationUrl.value} #AIart #lumiar`;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer,width=550,height=420",
  );
}

async function shareOnWhatsApp() {
  await ensureExploreShared();
  const text = `✨ AI art I made with Lumiar → ${generationUrl.value} #AIart #lumiar`;
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

async function shareOnTelegram() {
  await ensureExploreShared();
  const text = `✨ AI art I made with Lumiar #AIart #lumiar`;
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(generationUrl.value)}&text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

async function shareViaDevice() {
  isProcessing.value = true;
  try {
    await ensureExploreShared();
    let shareData: ShareData = {
      text: "✨ AI art I made with Lumiar",
      url: generationUrl.value,
    };
    try {
      const response = await fetch(props.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], `lumiar-${props.generationId}.png`, {
        type: blob.type || "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        shareData = { ...shareData, files: [file] };
      }
    } catch {
      // proceed without file attachment
    }
    await navigator.share(shareData);
  } catch (err) {
    if (err instanceof Error && err.name !== "AbortError") {
      toast.add({ title: "Share failed", color: "error" });
    }
  } finally {
    isProcessing.value = false;
  }
}

const shareItems = computed(() => {
  const items: { label: string; icon: string; onSelect: () => void }[] = [
    {
      label: "Copy link",
      icon: "i-lucide-link",
      onSelect: () => withExploreCheck(copyLink),
    },
    {
      label: "Share on X",
      icon: "i-lucide-external-link",
      onSelect: () => withExploreCheck(shareOnX),
    },
    {
      label: "Share on WhatsApp",
      icon: "i-lucide-message-circle",
      onSelect: () => withExploreCheck(shareOnWhatsApp),
    },
    {
      label: "Share on Telegram",
      icon: "i-lucide-send",
      onSelect: () => withExploreCheck(shareOnTelegram),
    },
  ];
  if (canWebShare.value) {
    items.push({
      label: "Share via device",
      icon: "i-lucide-smartphone",
      onSelect: () => withExploreCheck(shareViaDevice),
    });
  }
  return [items];
});
</script>

<template>
  <UDropdownMenu :items="shareItems">
    <UButton
      icon="i-lucide-send"
      :size="size ?? 'sm'"
      :variant="variant ?? 'ghost'"
      color="neutral"
      :loading="isProcessing"
    >
      <span class="hidden sm:inline">Share</span>
    </UButton>
  </UDropdownMenu>

  <UModal v-model:open="showConfirmModal">
    <template #content>
      <div>
        <div
          class="relative px-4 py-4 sm:px-6 flex items-center justify-between"
        >
          <h3
            class="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5"
          >
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 flex-shrink-0"
            >
              <UIcon name="i-lucide-globe" class="size-[18px]" />
            </span>
            Share this image?
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="-my-1"
            @click="handleModalCancel"
          />
          <div
            class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />
        </div>

        <div class="px-4 py-5 sm:p-6 space-y-4">
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Sharing this image will also make it
            <span class="font-medium text-zinc-700 dark:text-zinc-300"
              >publicly visible on Explore</span
            >
            so anyone with the link can view it.
          </p>
          <label
            class="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <input
              v-model="dontShowAgain"
              type="checkbox"
              class="size-4 rounded border-zinc-300 dark:border-zinc-600 accent-primary cursor-pointer"
            />
            <span
              class="text-sm text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors"
              >Don't show this again</span
            >
          </label>
        </div>

        <div
          class="px-4 py-4 sm:px-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3"
        >
          <UButton color="neutral" variant="outline" @click="handleModalCancel">
            Cancel
          </UButton>
          <UButton
            class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
            @click="handleModalConfirm"
          >
            Continue & Share
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
