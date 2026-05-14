<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";
import { useProfile } from "~/composables/useProfile";

const { profile, fetchProfile, loading: profileLoading } = useProfile();
const colorMode = useColorMode();
const router = useRouter();
const authService = useAuthService();

const isAuthenticated = computed(() => Boolean(profile.value?.id));

const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (val) => {
    colorMode.preference = val ? "dark" : "light";
  },
});

const avatarLabel = computed(() => {
  const name = profile.value?.username ?? "";
  return name.slice(0, 2).toUpperCase();
});

const profileItems = computed(() => [
  [
    {
      label: profile.value?.username ?? "",
      disabled: true,
    },
  ],
  [
    {
      label: "My Profile",
      icon: "i-lucide-user",
      onSelect: () => navigateTo("/profile"),
    },
    {
      label: "Edit Profile",
      icon: "i-lucide-pencil",
      onSelect: () => navigateTo("/profile/edit"),
    },
    {
      label: "Explore",
      icon: "i-lucide-compass",
      onSelect: () => navigateTo("/explore"),
    },
  ],
  [{ label: "Sign out", icon: "i-lucide-log-out", onSelect: handleSignOut }],
]);

async function handleSignOut() {
  await authService.signOut();
  router.push("/auth/login");
}

onMounted(() => {
  if (isAuthenticated.value) {
    fetchProfile();
  }
});
</script>

<template>
  <header
    class="fixed top-0 inset-x-0 z-50 h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md"
  >
    <div
      class="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4"
    >
      <NuxtLink
        to="/"
        class="flex items-center gap-2 font-semibold text-lg tracking-tight"
      >
        <UIcon name="i-lucide-sparkles" class="text-primary size-5" />
        <span>Lumiar</span>
      </NuxtLink>

      <nav class="hidden md:flex items-center gap-1">
        <UButton to="/" variant="ghost" size="sm" color="neutral"
          >Generate</UButton
        >
        <UButton to="/explore" variant="ghost" size="sm" color="neutral"
          >Explore</UButton
        >
      </nav>

      <div class="flex items-center gap-2">
        <UButton
          :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="isDark = !isDark"
        />

        <template v-if="isAuthenticated">
          <TokenBadge />
          <UDropdownMenu :items="profileItems">
            <UButton
              variant="ghost"
              color="neutral"
              square
              class="rounded-full p-0.5"
            >
              <UAvatar
                :src="profile?.avatar_url ?? user?.user_metadata?.avatar_url"
                :alt="avatarLabel"
                :fallback="avatarLabel"
                size="sm"
                class="ring-2 ring-primary/30 hover:ring-primary/60 transition-all"
              />
            </UButton>
          </UDropdownMenu>
        </template>

        <template v-else>
          <UButton to="/auth/login" variant="ghost" size="sm" color="neutral"
            >Sign in</UButton
          >
          <UButton to="/auth/register" size="sm">Get started</UButton>
        </template>
      </div>
    </div>
  </header>
</template>
