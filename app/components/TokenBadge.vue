<script setup lang="ts">
const { balance } = useTokens();
</script>

<template>
  <NuxtLink
    to="/profile"
    class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium"
  >
    <UIcon name="i-lucide-zap" class="size-3.5 text-amber-500" />
    <span>{{ balance ?? "—" }}</span>
  </NuxtLink>
</template>
