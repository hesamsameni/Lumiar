<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";
import { useProfile } from "~/composables/useProfile";

const { profile } = useProfile();
const { user, ready, isAuthenticated } = useAuthState();
const colorMode = useColorMode();
const router = useRouter();
const authService = useAuthService();

const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (val) => {
    colorMode.preference = val ? "dark" : "light";
  },
});

const avatarLabel = computed(() => {
  const name = profile.value?.username ?? user.value?.email ?? "";
  return name.slice(0, 1).toUpperCase();
});

const profileItems = computed(() => [
  [
    {
      label: profile.value?.username ?? user.value?.email ?? "",
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
    {
      label: "Prompt Library",
      icon: "i-lucide-library",
      onSelect: () => navigateTo("/prompt-library"),
    },
    ...(profile.value?.is_admin
      ? [
          {
            label: "Admin Dashboard",
            icon: "i-lucide-shield",
            onSelect: () => navigateTo("/admin"),
          },
        ]
      : []),
  ],
  [{ label: "Sign out", icon: "i-lucide-log-out", onSelect: handleSignOut }],
]);

async function handleSignOut() {
  await authService.signOut();
  router.push("/auth/login");
}
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
        <img src="/logo.svg" alt="Lumiar logo" class="size-6 object-contain" />
        <span>Lumiar</span>
      </NuxtLink>

      <nav class="hidden md:flex items-center gap-1">
        <UButton to="/" variant="ghost" size="sm" color="neutral"
          >Generate</UButton
        >
        <UButton to="/explore" variant="ghost" size="sm" color="neutral"
          >Explore</UButton
        >
        <UButton to="/prompt-library" variant="ghost" size="sm" color="neutral"
          >Prompts</UButton
        >
        <UButton
          v-if="profile?.is_admin"
          to="/admin"
          variant="ghost"
          size="sm"
          color="neutral"
          icon="i-lucide-shield"
          >Admin</UButton
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
                :src="
                  profile?.avatar_url ||
                  (user?.user_metadata?.avatar_url as string | undefined) ||
                  undefined
                "
                :alt="avatarLabel"
                :fallback="avatarLabel"
                size="sm"
                class="ring-2 ring-primary/30 hover:ring-primary/60 transition-all"
              />
            </UButton>
          </UDropdownMenu>
        </template>

        <template v-else-if="ready">
          <UButton to="/auth/login" variant="ghost" size="sm" color="neutral"
            >Sign in</UButton
          >
          <UButton to="/auth/register" size="sm">Get started</UButton>
        </template>
      </div>
    </div>
  </header>
</template>
