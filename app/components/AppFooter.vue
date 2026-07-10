<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<template>
  <footer
    class="relative border-t border-zinc-100/70 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 py-6 text-xs text-zinc-500 dark:text-zinc-400 backdrop-blur"
  >
    <div
      class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
    />
    <div
      class="max-w-7xl mx-auto px-4 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left"
    >
      <div class="space-y-1">
        <span class="font-display font-bold text-gradient-brand"
          >© {{ currentYear }} Lumiar</span
        >
        <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
          All rights reserved.
        </p>
      </div>
      <div
        class="flex flex-wrap justify-center gap-3 text-xs font-medium text-zinc-600 dark:text-zinc-300"
      >
        <NuxtLink
          to="/terms"
          class="hover:text-zinc-900 dark:hover:text-white transition-colors"
          >Terms</NuxtLink
        >
        <NuxtLink
          to="/policy"
          class="hover:text-zinc-900 dark:hover:text-white transition-colors"
          >Privacy</NuxtLink
        >
        <NuxtLink
          to="/terms"
          class="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >Cookie policy</NuxtLink
        >
        <a
          href="https://github.com/hesamsameni"
          target="_blank"
          rel="noreferrer"
          class="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Made with love by Hesam
        </a>
      </div>
    </div>
  </footer>
</template>
