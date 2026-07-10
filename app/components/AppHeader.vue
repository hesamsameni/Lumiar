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

function isActive(to: string) {
  if (to === "/") return route.path === "/";
  return route.path.startsWith(to);
}

async function handleSignOut() {
  await authService.signOut();
  router.push("/auth/login");
}
</script>

<template>
  <header
    class="fixed top-0 inset-x-0 z-50 h-16 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl"
  >
    <!-- Brand gradient hairline -->
    <div
      class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
    />
    <div
      class="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4"
    >
      <NuxtLink to="/" class="group flex items-center gap-2.5">
        <img
          src="/logo.svg"
          alt="Lumiar logo"
          class="size-7 object-contain transition-transform duration-300 group-hover:scale-105"
        />
        <span
          class="font-display text-lg font-bold tracking-tight text-gradient-brand"
          >Lumiar</span
        >
      </NuxtLink>

      <nav
        aria-label="Primary navigation"
        class="hidden md:flex items-center gap-0.5 p-1 rounded-full bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 backdrop-blur"
      >
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all"
          :class="
            isActive(link.to)
              ? 'bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          "
        >
          <UIcon
            :name="link.icon"
            class="size-3.5"
            :class="isActive(link.to) ? 'text-primary' : ''"
          />
          <span :class="isActive(link.to) ? 'text-gradient-brand' : ''">{{
            link.label
          }}</span>
        </NuxtLink>
      </nav>

      <div class="flex items-center gap-2">
        <UButton
          :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-full"
          @click="isDark = !isDark"
        />

        <template v-if="isAuthenticated">
          <TokenBadge class="hidden sm:flex" />
          <UDropdownMenu :items="profileItems">
            <button
              type="button"
              aria-label="Open account menu"
              class="rounded-full p-px bg-conic-brand hover:shadow-glow-brand transition-all"
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
                class="ring-2 ring-white dark:ring-zinc-950"
              />
            </button>
          </UDropdownMenu>
        </template>

        <template v-else-if="ready">
          <UButton to="/auth/login" variant="ghost" size="sm" color="neutral"
            >Sign in</UButton
          >
          <UButton
            to="/auth/register"
            size="sm"
            class="hidden sm:inline-flex !bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
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
        <!-- Brand gradient edge -->
        <div
          class="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-indigo-500/50 via-violet-500/40 to-fuchsia-500/50"
        />
        <!-- Sidebar header -->
        <div
          class="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0"
        >
          <NuxtLink to="/" class="flex items-center gap-2.5">
            <img
              src="/logo.svg"
              alt="Lumiar logo"
              class="size-7 object-contain"
            />
            <span
              class="font-display text-lg font-bold tracking-tight text-gradient-brand"
              >Lumiar</span
            >
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
        <nav
          aria-label="Mobile navigation"
          class="flex-1 overflow-y-auto p-4 space-y-1"
        >
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            :class="
              isActive(link.to)
                ? 'bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-fuchsia-500/10 text-primary ring-1 ring-primary/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
            "
          >
            <span
              v-if="isActive(link.to)"
              class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-gradient-brand"
            />
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
              <span
                class="rounded-full p-px bg-conic-brand flex-shrink-0"
              >
                <UAvatar
                  :src="
                    profile?.avatar_url ||
                    (user?.user_metadata?.avatar_url as string | undefined) ||
                    undefined
                  "
                  :fallback="avatarLabel"
                  size="sm"
                  class="ring-2 ring-white dark:ring-zinc-950"
                />
              </span>
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
            <UButton
              to="/auth/register"
              block
              class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
              >Get started</UButton
            >
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
