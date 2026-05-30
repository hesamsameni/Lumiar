<template>
  <div
    class="min-h-screen flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors overflow-x-hidden"
  >
    <AppHeader />
    <main class="flex-1 pt-16 relative">
      <slot />
    </main>
    <AppFooter />
    <CookieConsentModal />
  </div>
</template>
