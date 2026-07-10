<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const router = useRouter();
const { isAuthenticated } = useAuthState();

onMounted(() => {
  // The referral plugin already stored the cookie.
  // Redirect authenticated users to home, new users to register.
  if (isAuthenticated.value) {
    router.replace("/");
  } else {
    router.replace("/auth/register");
  }
});
</script>

<template>
  <div
    class="relative isolate min-h-screen flex flex-col items-center justify-center px-4 bg-white dark:bg-zinc-950 overflow-hidden"
  >
    <AuroraBackdrop />
    <!-- Shown briefly while redirect happens -->
    <div class="text-center space-y-4 max-w-sm">
      <div
        class="size-16 rounded-2xl bg-gradient-brand shadow-glow-brand flex items-center justify-center mx-auto text-white"
      >
        <UIcon name="i-lucide-gift" class="size-8" />
      </div>
      <h1
        class="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-white"
      >
        You've been invited to Lumiar!
      </h1>
      <p class="text-zinc-500 dark:text-zinc-400">
        Sign up and you'll
        <span class="font-semibold text-gradient-brand"
          >both get 50 free credits</span
        >
        to generate AI images.
      </p>
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin text-primary mx-auto"
      />
    </div>
  </div>
</template>
