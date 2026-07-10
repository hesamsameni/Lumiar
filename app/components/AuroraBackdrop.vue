<script setup lang="ts">
// Animated aurora + grain backdrop. Place as the first child of a
// `relative isolate` container; it breaks out to full viewport width.
</script>

<template>
  <div
    class="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-screen h-[760px] -z-10 overflow-hidden [mask-image:radial-gradient(120%_75%_at_50%_20%,black_45%,transparent_100%)]"
    aria-hidden="true"
  >
    <div
      class="absolute left-1/2 -top-16 -translate-x-1/2 w-[70vw] max-w-[1100px] h-[520px] rounded-full bg-indigo-500/25 dark:bg-indigo-500/25 blur-[150px] animate-aurora"
    />
    <div
      class="absolute left-[8%] sm:left-[18%] top-24 w-[45vw] max-w-[560px] h-[440px] rounded-full bg-fuchsia-500/20 dark:bg-fuchsia-500/20 blur-[150px] animate-aurora-slow"
    />
    <div
      class="absolute right-[8%] sm:right-[16%] top-12 w-[42vw] max-w-[520px] h-[420px] rounded-full bg-violet-500/20 dark:bg-violet-500/20 blur-[140px] animate-aurora"
    />
    <div
      class="absolute inset-0 bg-grain opacity-[0.12] dark:opacity-[0.07] mix-blend-overlay"
    />
  </div>
</template>
