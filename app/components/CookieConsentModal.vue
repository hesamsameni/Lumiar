<script setup lang="ts">
const cookieConsent = useCookie<string>("lumiar_cookie_consent", {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  path: "/",
});
const showModal = ref(false);
const alreadyAccepted = computed(() => cookieConsent.value === "accepted");

onMounted(() => {
  if (!alreadyAccepted.value) {
    showModal.value = true;
  }
});

function acceptCookies() {
  cookieConsent.value = "accepted";
  showModal.value = false;
}
</script>

<template>
  <Transition
    appear
    enter-active-class="transition duration-250 ease-out"
    enter-from-class="opacity-0 translate-y-6"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-4"
  >
    <div
      v-if="showModal"
      class="pointer-events-auto fixed inset-x-4 bottom-6 z-50 md:bottom-8"
      role="status"
      aria-live="polite"
    >
      <div
        class="w-full max-w-5xl mx-auto rounded-[32px] border border-zinc-200 bg-white px-6 py-5 shadow-[0_25px_70px_rgba(15,23,42,0.25)] dark:border-zinc-800 dark:bg-zinc-950/95"
      >
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
              <UIcon name="i-lucide-cookie" class="size-5" />
            </div>
            <div class="space-y-1">
              <p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                We use cookies to keep Lumiar running smoothly.
              </p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">
                By continuing, you agree to our
                <NuxtLink to="/policy" class="font-semibold text-primary underline-offset-4 hover:underline"
                  >Privacy Policy</NuxtLink
                >
                and
                <NuxtLink to="/terms" class="font-semibold text-primary underline-offset-4 hover:underline"
                  >Terms of Service</NuxtLink
                >.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 text-sm md:flex-shrink-0">
            <UButton
              size="sm"
              class="min-w-[120px]"
              @click="acceptCookies"
            >
              Accept cookies
            </UButton>
            <UButton
              size="sm"
              variant="ghost"
              color="neutral"
              class="min-w-[120px]"
              to="/policy"
            >
              Learn more
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
