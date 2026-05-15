<template>
  <div
    class="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors overflow-x-hidden"
  >
    <AppHeader />
    <main class="pt-16 relative">
      <slot />
    </main>
  </div>
</template>
