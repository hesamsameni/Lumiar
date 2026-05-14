<script setup lang="ts">
definePageMeta({ layout: false });

const router = useRouter();
const route = useRoute();

onMounted(() => {
  const nextQuery = route.query.next as string | undefined;
  const next = nextQuery && nextQuery.startsWith("/") ? nextQuery : "/";
  router.replace(next);
});
</script>

<template>
  <div
    class="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center"
  >
    <div class="text-center space-y-3">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary mx-auto"
      />
      <p class="text-sm text-zinc-500 dark:text-zinc-400">Signing you in…</p>
    </div>
  </div>
</template>
