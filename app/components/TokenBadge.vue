<script setup lang="ts">
const { balance } = useTokens();
</script>

<template>
  <NuxtLink
    to="/credits"
    class="group rounded-full p-px bg-gradient-brand hover:shadow-glow-brand transition-all"
  >
    <span
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-950 text-sm font-medium transition-colors group-hover:bg-zinc-50 dark:group-hover:bg-zinc-900"
    >
      <UIcon name="i-lucide-zap" class="size-3.5 text-amber-500" />
      <span class="tabular-nums">{{ balance ?? "—" }}</span>
    </span>
  </NuxtLink>
</template>
