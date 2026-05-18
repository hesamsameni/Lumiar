<script setup lang="ts">
import { useAuthService } from "~/services/auth.service";

definePageMeta({ layout: false });

const authService = useAuthService();
const toast = useToast();
const router = useRouter();

const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);

async function register() {
  if (password.value !== confirmPassword.value) {
    toast.add({ title: "Passwords do not match", color: "error" });
    return;
  }
  loading.value = true;
  const { error } = await authService.signUpWithPassword(
    email.value,
    password.value,
    `${window.location.origin}/auth/callback`,
  );
  loading.value = false;
  if (error) {
    toast.add({
      title: "Registration failed",
      description: error.message,
      color: "error",
    });
  } else {
    toast.add({
      title: "Check your email",
      description: "We sent you a confirmation link.",
      color: "success",
    });
    router.push("/auth/login");
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
          <img src="/logo.svg" alt="Lumiar logo" class="text-primary size-6" />
          <span>Lumiar</span>
        </NuxtLink>
        <h1 class="text-2xl font-bold">Create an account</h1>
        <p class="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Start with 25 free credits
        </p>
      </div>

      <UCard>
        <div class="space-y-4">
          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Password">
            <UInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Confirm Password">
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              class="w-full"
            />
          </UFormField>

          <UButton block :loading="loading" @click="register"
            >Create account</UButton
          >

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
        </div>
      </UCard>

      <p class="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-4">
        Already have an account?
        <NuxtLink to="/auth/login" class="text-primary hover:underline"
          >Sign in</NuxtLink
        >
      </p>
    </div>
  </div>
</template>
