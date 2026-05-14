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
    class="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center px-4"
  >
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 font-semibold text-xl mb-6"
        >
          <img src="/logo.svg" alt="Lumiar logo" class="text-primary size-6" />
          <span>Lumiar</span>
        </NuxtLink>
        <h1 class="text-2xl font-bold">Set new password</h1>
      </div>

      <UCard>
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
          <UButton block :loading="loading" @click="updatePassword"
            >Update password</UButton
          >
        </div>
      </UCard>
    </div>
  </div>
</template>
