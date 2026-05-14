<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";

const authService = useAuthService();
const { profile, fetchProfile } = useProfile();

onMounted(async () => {
  const currentUser = await authService.getCurrentUser();

  if (!currentUser?.id) {
    await navigateTo("/auth/login", { replace: true });
    return;
  }

  await fetchProfile();

  if (profile.value?.username) {
    await navigateTo(`/profile/${profile.value.username}`, { replace: true });
    return;
  }

  await navigateTo("/profile/edit", { replace: true });
});
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <UIcon
      name="i-lucide-loader-circle"
      class="size-8 animate-spin text-primary"
    />
  </div>
</template>
