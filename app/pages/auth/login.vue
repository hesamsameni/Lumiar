<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";

definePageMeta({ layout: false });

const authService = useAuthService();
const toast = useToast();

const email = ref("");
const password = ref("");
const loading = ref(false);
const magicLinkSent = ref(false);
const mode = ref<"password" | "magic">("password");

async function signInWithPassword() {
  loading.value = true;
  const { error } = await authService.signInWithPassword(
    email.value,
    password.value,
  );
  loading.value = false;
  if (error) {
    toast.add({
      title: "Sign in failed",
      description: error.message,
      color: "error",
    });
  } else {
    await navigateTo("/", { replace: true });
  }
}

async function sendMagicLink() {
  loading.value = true;
  const { error } = await authService.signInWithMagicLink(
    email.value,
    `${window.location.origin}/auth/callback`,
  );
  loading.value = false;
  if (error) {
    toast.add({
      title: "Failed to send link",
      description: error.message,
      color: "error",
    });
  } else {
    magicLinkSent.value = true;
    toast.add({
      title: "Magic link sent!",
      description: "Check your email inbox.",
      color: "success",
    });
  }
}

async function signInWithGoogle() {
  const { error } = await authService.signInWithGoogle(
    `${window.location.origin}/auth/callback`,
  );
  if (error)
    toast.add({
      title: "Google sign in failed",
      description: error.message,
      color: "error",
    });
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
        <h1 class="text-2xl font-bold">Welcome back</h1>
        <p class="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Sign in to your account
        </p>
      </div>

      <UCard>
        <div v-if="!magicLinkSent" class="space-y-4">
          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="w-full"
            />
          </UFormField>

          <template v-if="mode === 'password'">
            <UFormField label="Password">
              <UInput
                v-model="password"
                type="password"
                placeholder="••••••••"
                class="w-full"
              />
            </UFormField>
            <div class="flex justify-end">
              <NuxtLink
                to="/auth/forgot-password"
                class="text-xs text-primary hover:underline"
              >
                Forgot password?
              </NuxtLink>
            </div>
            <UButton block :loading="loading" @click="signInWithPassword"
              >Sign in</UButton
            >
          </template>

          <template v-else>
            <UButton
              block
              :loading="loading"
              icon="i-lucide-mail"
              @click="sendMagicLink"
            >
              Send magic link
            </UButton>
          </template>

          <div class="flex items-center gap-3">
            <div class="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            <span class="text-xs text-zinc-400">or</span>
            <div class="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          </div>

          <UButton
            block
            variant="outline"
            color="neutral"
            @click="signInWithGoogle"
          >
            <UIcon name="i-simple-icons-google" class="size-4" />
            Continue with Google
          </UButton>

          <UButton
            block
            variant="ghost"
            color="neutral"
            size="sm"
            @click="mode = mode === 'password' ? 'magic' : 'password'"
          >
            {{
              mode === "password"
                ? "Use magic link instead"
                : "Use password instead"
            }}
          </UButton>
        </div>

        <div v-else class="text-center py-4 space-y-3">
          <UIcon
            name="i-lucide-mail-check"
            class="size-12 text-primary mx-auto"
          />
          <p class="font-medium">Check your email</p>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            We sent a magic link to <strong>{{ email }}</strong>
          </p>
          <UButton variant="ghost" size="sm" @click="magicLinkSent = false"
            >Send again</UButton
          >
        </div>
      </UCard>

      <p class="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-4">
        Don't have an account?
        <NuxtLink to="/auth/register" class="text-primary hover:underline"
          >Sign up</NuxtLink
        >
      </p>
    </div>
  </div>
</template>
