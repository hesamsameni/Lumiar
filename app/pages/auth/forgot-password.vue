<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";

definePageMeta({ layout: false });

const authService = useAuthService();
const toast = useToast();
const email = ref("");
const loading = ref(false);
const sent = ref(false);

async function sendReset() {
  loading.value = true;
  const { error } = await authService.resetPasswordForEmail(
    email.value,
    `${window.location.origin}/auth/callback?next=/auth/reset-password`,
  );
  loading.value = false;
  if (error) {
    toast.add({ title: "Failed", description: error.message, color: "error" });
  } else {
    sent.value = true;
  }
}
</script>

<template>
  <div
    class="relative isolate min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center px-4 overflow-hidden"
  >
    <AuroraBackdrop />
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <NuxtLink to="/" class="inline-flex items-center gap-2 mb-6">
          <img src="/logo.svg" alt="Lumiar logo" class="size-7" />
          <span class="font-display font-bold text-xl text-gradient-brand"
            >Lumiar</span
          >
        </NuxtLink>
        <h1 class="font-display text-2xl font-bold tracking-tight">
          Reset password
        </h1>
        <p class="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          We'll send you a reset link
        </p>
      </div>

      <div
        class="rounded-panel border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6"
      >
        <div v-if="!sent" class="space-y-4">
          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="w-full"
            />
          </UFormField>
          <UButton
            block
            :loading="loading"
            class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
            @click="sendReset"
            >Send reset link</UButton
          >
          <UButton
            block
            variant="ghost"
            color="neutral"
            size="sm"
            to="/auth/login"
          >
            Back to sign in
          </UButton>
        </div>

        <div v-else class="text-center py-4 space-y-3">
          <span
            class="flex size-12 items-center justify-center rounded-2xl mx-auto bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15"
          >
            <UIcon name="i-lucide-mail-check" class="size-6" />
          </span>
          <p class="font-medium">Check your email</p>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Password reset link sent to <strong>{{ email }}</strong>
          </p>
          <NuxtLink
            to="/auth/login"
            class="text-primary text-sm hover:underline"
            >Back to sign in</NuxtLink
          >
        </div>
      </div>
    </div>
  </div>
</template>
