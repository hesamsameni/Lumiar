<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";
import { useProfileService } from "~/services/profile.service";

const authService = useAuthService();
const profileService = useProfileService();
const toast = useToast();
const router = useRouter();

const username = ref("");
const fullName = ref("");
const bio = ref("");
const loading = ref(true);
const saving = ref(false);

onMounted(async () => {
  try {
    const authUser = await authService.getCurrentUser();

    if (!authUser?.id) {
      await navigateTo("/auth/login", { replace: true });
      return;
    }

    const { data } = await profileService.getProfileById(authUser.id);

    if (data) {
      username.value = (data as { username?: string }).username ?? "";
      fullName.value = (data as { full_name?: string }).full_name ?? "";
      bio.value = (data as { bio?: string }).bio ?? "";
    }
  } finally {
    loading.value = false;
  }
});

async function save() {
  const authUser = await authService.getCurrentUser();
  if (!authUser?.id) {
    await navigateTo("/auth/login", { replace: true });
    return;
  }

  const nextUsername = username.value.trim();
  if (!nextUsername) {
    toast.add({
      title: "Username is required",
      description: "Please choose a username before saving.",
      color: "warning",
    });
    return;
  }

  saving.value = true;
  const { error } = await profileService.upsertProfile({
    id: authUser.id,
    username: nextUsername,
    full_name: fullName.value,
    bio: bio.value,
  });
  saving.value = false;
  if (error) {
    toast.add({
      title: "Failed to save",
      description: error.message,
      color: "error",
    });
  } else {
    toast.add({ title: "Profile updated!", color: "success" });
    router.push(`/profile/${nextUsername}`);
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-10">
    <div class="flex items-center gap-3 mb-8">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="router.back()"
      />
      <h1 class="text-2xl font-bold">Edit profile</h1>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <UCard v-else>
      <div class="space-y-5">
        <UFormField label="Username" required>
          <UInput v-model="username" placeholder="yourname" class="w-full" />
        </UFormField>

        <UFormField label="Display name">
          <UInput v-model="fullName" placeholder="Your Name" class="w-full" />
        </UFormField>

        <UFormField label="Bio">
          <UTextarea
            v-model="bio"
            placeholder="Tell the world about yourself…"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" color="neutral" @click="router.back()"
            >Cancel</UButton
          >
          <UButton :loading="saving" @click="save">Save changes</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
