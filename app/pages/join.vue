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
    class="min-h-screen flex flex-col items-center justify-center px-4 bg-white dark:bg-zinc-950"
  >
    <!-- Shown briefly while redirect happens -->
    <div class="text-center space-y-4 max-w-sm">
      <div
        class="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"
      >
        <UIcon name="i-lucide-gift" class="size-8 text-primary" />
      </div>
      <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
        You've been invited to Lumiar!
      </h1>
      <p class="text-zinc-500 dark:text-zinc-400">
        Sign up and you'll
        <span class="font-semibold text-zinc-700 dark:text-zinc-200"
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
