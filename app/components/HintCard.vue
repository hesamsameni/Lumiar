<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}>();

const emit = defineEmits<{
  action: [];
  dismiss: [];
}>();
</script>

<template>
  <div
    class="group relative flex flex-col gap-2.5 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/50 bg-white/80 dark:bg-zinc-800/60 backdrop-blur-md px-4 py-3.5 text-left shadow-sm shadow-zinc-200/60 dark:shadow-black/20 transition-all hover:border-primary/30 dark:hover:border-primary/25 hover:shadow-md hover:shadow-primary/5"
  >
    <!-- Top row: icon + dismiss -->
    <div class="flex items-center justify-between gap-2">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10"
      >
        <UIcon :name="icon" class="size-4" />
      </div>
      <button
        type="button"
        class="flex items-center justify-center rounded-lg p-1 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-500 dark:hover:text-zinc-400 transition-all"
        title="Dismiss"
        @click.stop="emit('dismiss')"
      >
        <UIcon name="i-lucide-x" class="size-3.5" />
      </button>
    </div>

    <!-- Text body -->
    <div class="space-y-0.5">
      <p
        class="text-xs font-semibold text-zinc-800 dark:text-zinc-100 leading-snug"
      >
        {{ title }}
      </p>
      <p class="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {{ description }}
      </p>
    </div>

    <!-- Action link -->
    <template v-if="actionLabel">
      <NuxtLink
        v-if="actionTo"
        :to="actionTo"
        class="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:gap-1.5 transition-all"
      >
        {{ actionLabel }}
        <UIcon
          name="i-lucide-arrow-right"
          class="size-3 transition-transform group-hover:translate-x-0.5"
        />
      </NuxtLink>
      <button
        v-else
        type="button"
        class="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:gap-1.5 transition-all"
        @click="emit('action')"
      >
        {{ actionLabel }}
        <UIcon
          name="i-lucide-arrow-right"
          class="size-3 transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </template>
  </div>
</template>
