<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";
import { useProfile } from "~/composables/useProfile";

const { profile } = useProfile();
const { user, ready, isAuthenticated } = useAuthState();
const colorMode = useColorMode();
const router = useRouter();
const route = useRoute();
const authService = useAuthService();

const sidebarOpen = ref(false);
watch(
  () => route.path,
  () => {
    sidebarOpen.value = false;
  },
);

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
  ],
  [{ label: "Sign out", icon: "i-lucide-log-out", onSelect: handleSignOut }],
]);

const navLinks = computed(() => [
  { label: "Generate", to: "/", icon: "i-lucide-sparkles" },
  { label: "Explore", to: "/explore", icon: "i-lucide-compass" },
  { label: "Prompts", to: "/prompt-library", icon: "i-lucide-library" },
  ...(profile.value?.is_admin
    ? [{ label: "Admin", to: "/admin", icon: "i-lucide-shield" }]
    : []),
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

      <nav class="hidden md:flex items-center gap-1 flex-1 justify-center">
        <UButton
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          variant="ghost"
          size="sm"
          color="neutral"
        >
          {{ link.label }}
        </UButton>
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
          <TokenBadge class="hidden sm:flex" />
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
          <UButton to="/auth/register" size="sm" class="hidden sm:inline-flex"
            >Get started</UButton
          >
        </template>

        <!-- Mobile hamburger -->
        <UButton
          :icon="sidebarOpen ? 'i-lucide-x' : 'i-lucide-menu'"
          variant="ghost"
          color="neutral"
          size="sm"
          class="md:hidden"
          @click="sidebarOpen = !sidebarOpen"
        />
      </div>
    </div>
  </header>

  <!-- Mobile sidebar -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 md:hidden bg-black/30 backdrop-blur-sm"
        @click="sidebarOpen = false"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <div
        v-if="sidebarOpen"
        class="fixed left-0 top-0 h-full w-72 z-50 md:hidden bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col"
      >
        <!-- Sidebar header -->
        <div
          class="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0"
        >
          <NuxtLink
            to="/"
            class="flex items-center gap-2 font-semibold text-lg tracking-tight"
          >
            <img
              src="/logo.svg"
              alt="Lumiar logo"
              class="size-6 object-contain"
            />
            <span>Lumiar</span>
          </NuxtLink>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="sidebarOpen = false"
          />
        </div>

        <!-- Nav links -->
        <nav class="flex-1 overflow-y-auto p-4 space-y-1">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            :class="
              $route.path === link.to
                ? 'bg-primary/10 text-primary'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
            "
          >
            <UIcon :name="link.icon" class="size-4 flex-shrink-0" />
            {{ link.label }}
          </NuxtLink>
        </nav>

        <!-- Bottom: user info or sign in -->
        <div
          class="p-4 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0"
        >
          <template v-if="isAuthenticated">
            <div class="flex items-center gap-3 mb-3 px-1">
              <UAvatar
                :src="
                  profile?.avatar_url ||
                  (user?.user_metadata?.avatar_url as string | undefined) ||
                  undefined
                "
                :fallback="avatarLabel"
                size="sm"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">
                  {{ profile?.username ?? user?.email }}
                </p>
              </div>
              <TokenBadge />
            </div>
            <div class="space-y-1">
              <NuxtLink
                to="/profile"
                class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <UIcon name="i-lucide-user" class="size-4" /> My Profile
              </NuxtLink>
              <NuxtLink
                to="/profile/edit"
                class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <UIcon name="i-lucide-pencil" class="size-4" /> Edit Profile
              </NuxtLink>
              <button
                class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                @click="handleSignOut"
              >
                <UIcon name="i-lucide-log-out" class="size-4" /> Sign out
              </button>
            </div>
          </template>

          <template v-else-if="ready">
            <UButton
              to="/auth/login"
              variant="outline"
              color="neutral"
              block
              class="mb-2"
              >Sign in</UButton
            >
            <UButton to="/auth/register" block>Get started</UButton>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
