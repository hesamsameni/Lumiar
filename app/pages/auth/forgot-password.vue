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
    class="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center px-4"
  >
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 font-semibold text-xl mb-6"
        >
          <UIcon name="i-lucide-sparkles" class="text-primary size-6" />
          <span>Lumiar</span>
        </NuxtLink>
        <h1 class="text-2xl font-bold">Reset password</h1>
        <p class="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          We'll send you a reset link
        </p>
      </div>

      <UCard>
        <div v-if="!sent" class="space-y-4">
          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="w-full"
            />
          </UFormField>
          <UButton block :loading="loading" @click="sendReset"
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
          <UIcon
            name="i-lucide-mail-check"
            class="size-12 text-primary mx-auto"
          />
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
      </UCard>
    </div>
  </div>
</template>
