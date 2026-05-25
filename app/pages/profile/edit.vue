<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";
import { useProfileService } from "~/services/profile.service";
import { compressImage, convertHeicToJpeg } from "~/utils/imageCompression";

const authService = useAuthService();
const profileService = useProfileService();
const { fetchProfile } = useProfile();
const { session } = useAuthState();
const toast = useToast();
const router = useRouter();

const username = ref("");
const fullName = ref("");
const bio = ref("");
const currentAvatarUrl = ref<string | null>(null);
const avatarFile = ref<File | null>(null);
const avatarPreviewUrl = ref<string | null>(null);
const avatarInput = ref<HTMLInputElement | null>(null);
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
      currentAvatarUrl.value =
        (data as { avatar_url?: string | null }).avatar_url ?? null;
    }
  } finally {
    loading.value = false;
  }
});

async function handleAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  avatarFile.value = file;

  // Convert HEIC to JPEG for the preview so the browser can render it
  const previewFile = await convertHeicToJpeg(file);

  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value);
  avatarPreviewUrl.value = URL.createObjectURL(previewFile);
}

const displayAvatarUrl = computed(
  () => avatarPreviewUrl.value ?? currentAvatarUrl.value ?? undefined,
);

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
  try {
    let newAvatarUrl: string | undefined;
    if (avatarFile.value) {
      const compressed = await compressImage(avatarFile.value, 400, 0.85);
      const formData = new FormData();
      formData.append("file", compressed);
      const oldAvatarParam = currentAvatarUrl.value
        ? `&oldUrl=${encodeURIComponent(currentAvatarUrl.value)}`
        : "";
      const { url } = await $fetch<{ url: string }>(
        `/api/upload?folder=profile-pictures${oldAvatarParam}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.value?.access_token ?? ""}`,
          },
          body: formData,
        },
      );
      newAvatarUrl = url;
    }

    const upsertInput: Parameters<typeof profileService.upsertProfile>[0] = {
      id: authUser.id,
      username: nextUsername,
      full_name: fullName.value,
      bio: bio.value,
      ...(newAvatarUrl !== undefined ? { avatar_url: newAvatarUrl } : {}),
    };
    const { error } = await profileService.upsertProfile(upsertInput);

    if (error) {
      const msg = (error as { message?: string; code?: string }).message ?? "";
      const code = (error as { code?: string }).code ?? "";
      const isUsernameTaken =
        code === "23505" || msg.toLowerCase().includes("username");
      toast.add({
        title: isUsernameTaken ? "Username already taken" : "Failed to save",
        description: isUsernameTaken
          ? `"${nextUsername}" is already in use. Please choose a different username.`
          : msg,
        color: "error",
      });
      return;
    }

    await fetchProfile();
    toast.add({ title: "Profile updated!", color: "success" });
    router.push(`/profile/${nextUsername}`);
  } catch (err) {
    toast.add({
      title: "Failed to save",
      description: err instanceof Error ? err.message : "Unknown error",
      color: "error",
    });
  } finally {
    saving.value = false;
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
        <!-- Avatar upload -->
        <div class="flex items-center gap-4">
          <div
            class="relative group cursor-pointer"
            @click="avatarInput?.click()"
          >
            <UAvatar
              :src="
                (displayAvatarUrl as string | null | undefined) || undefined
              "
              :fallback="username?.slice(0, 1).toUpperCase() || '?'"
              size="2xl"
              class="ring-4 ring-primary/20"
            />
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <UIcon name="i-lucide-camera" class="size-5 text-white" />
            </div>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-medium">Profile photo</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              JPG, PNG or WebP · max 10 MB
            </p>
            <UButton
              size="xs"
              variant="outline"
              color="neutral"
              icon="i-lucide-upload"
              @click="avatarInput?.click()"
            >
              Upload photo
            </UButton>
          </div>
          <input
            ref="avatarInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleAvatarChange"
          />
        </div>

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
