<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";

definePageMeta({ layout: false });

const authService = useAuthService();
const toast = useToast();
const router = useRouter();

const password = ref("");
const confirm = ref("");
const loading = ref(false);

async function updatePassword() {
  if (password.value !== confirm.value) {
    toast.add({ title: "Passwords do not match", color: "error" });
    return;
  }
  loading.value = true;
  const { error } = await authService.updatePassword(password.value);
  loading.value = false;
  if (error) {
    toast.add({
      title: "Update failed",
      description: error.message,
      color: "error",
    });
  } else {
    toast.add({ title: "Password updated!", color: "success" });
    router.push("/");
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
          Set new password
        </h1>
      </div>

      <div
        class="rounded-panel border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6"
      >
        <div class="space-y-4">
          <UFormField label="New password">
            <UInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Confirm new password">
            <UInput
              v-model="confirm"
              type="password"
              placeholder="••••••••"
              class="w-full"
            />
          </UFormField>
          <UButton
            block
            :loading="loading"
            class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
            @click="updatePassword"
            >Update password</UButton
          >
        </div>
      </div>
    </div>
  </div>
</template>
