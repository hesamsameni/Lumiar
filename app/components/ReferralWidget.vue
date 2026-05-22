<script setup lang="ts">
const { referralLink, stats, loadingStats, fetchStats } = useReferral();
const toast = useToast();
const copied = ref(false);

onMounted(() => fetchStats());

async function copyLink() {
  if (!referralLink.value) return;
  await navigator.clipboard.writeText(referralLink.value);
  copied.value = true;
  toast.add({ title: "Referral link copied!", icon: "i-lucide-link", color: "success" });
  setTimeout(() => (copied.value = false), 2000);
}

function shareOnX() {
  if (!referralLink.value) return;
  const text = `🎨 Join me on Lumiar – AI image generator. We both get 50 free credits! → ${referralLink.value}`;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer,width=550,height=420",
  );
}

function shareOnWhatsApp() {
  if (!referralLink.value) return;
  const text = `🎨 Join me on Lumiar – AI image generator. We both get 50 free credits! → ${referralLink.value}`;
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}
</script>

<template>
  <div
    class="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 space-y-5"
  >
    <!-- Header -->
    <div class="flex items-start gap-3">
      <div
        class="size-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"
      >
        <UIcon name="i-lucide-gift" class="size-5 text-primary" />
      </div>
      <div>
        <h3 class="font-semibold text-zinc-900 dark:text-white">
          Invite friends, earn credits
        </h3>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Share your link — you
          <span class="font-medium text-zinc-700 dark:text-zinc-300"
            >both get 50 free credits</span
          >
          when they join.
        </p>
      </div>
    </div>

    <!-- Stats -->
    <div
      v-if="stats"
      class="flex items-center gap-6 py-3 px-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
    >
      <div class="text-center">
        <p class="text-2xl font-bold text-zinc-900 dark:text-white">
          {{ stats.referral_count }}
        </p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
          {{ stats.referral_count === 1 ? "friend" : "friends" }} joined
        </p>
      </div>
      <div class="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
      <div class="text-center">
        <p class="text-2xl font-bold text-primary">
          {{ stats.credits_earned }}
        </p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">credits earned</p>
      </div>
    </div>
    <div
      v-else-if="loadingStats"
      class="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse"
    />

    <!-- Link + copy -->
    <div v-if="referralLink">
      <div
        class="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
      >
        <span
          class="flex-1 text-sm text-zinc-600 dark:text-zinc-400 truncate font-mono"
          >{{ referralLink }}</span
        >
        <UButton
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          size="xs"
          :color="copied ? 'success' : 'neutral'"
          variant="ghost"
          :aria-label="copied ? 'Copied' : 'Copy link'"
          @click="copyLink"
        />
      </div>

      <!-- Share shortcuts -->
      <div class="flex items-center gap-2 mt-3">
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-external-link"
          @click="shareOnX"
        >
          Share on X
        </UButton>
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-message-circle"
          @click="shareOnWhatsApp"
        >
          WhatsApp
        </UButton>
      </div>
    </div>

    <div
      v-else
      class="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse"
    />
  </div>
</template>
