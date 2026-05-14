<script setup lang="ts">
definePageMeta({ layout: false });

const router = useRouter();
const route = useRoute();

onMounted(async () => {
  const supabase = useSupabaseClient();
  const { session: authSession } = useAuthState();
  const { fetchProfile } = useProfile();

  // Fast path: session already available
  const {
    data: { session: existingSession },
  } = await supabase.auth.getSession();

  if (existingSession?.user) {
    authSession.value = existingSession;
    await fetchProfile();
  } else {
    // Wait for the auth session to be fully established.
    // If the user arrived via magic link or OAuth, SIGNED_IN fires once the
    // token exchange completes.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(async () => {
        // Final check in case event ordering missed the callback
        const {
          data: { session: timeoutSession },
        } = await supabase.auth.getSession();
        authSession.value = timeoutSession ?? null;
        if (timeoutSession?.user) {
          await fetchProfile();
        }
        resolve();
      }, 8000);

      const { data } = supabase.auth.onAuthStateChange(
        async (event, nextSession) => {
          if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
            clearTimeout(timer);
            data.subscription.unsubscribe();
            authSession.value = nextSession ?? null;
            if (nextSession?.user) {
              await fetchProfile();
            }
            resolve();
          }
        },
      );
    });
  }

  const nextQuery = route.query.next as string | undefined;
  const next = nextQuery && nextQuery.startsWith("/") ? nextQuery : "/";
  router.replace(next);
});
</script>

<template>
  <div
    class="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center"
  >
    <div class="text-center space-y-3">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary mx-auto"
      />
      <p class="text-sm text-zinc-500 dark:text-zinc-400">Signing you in…</p>
    </div>
  </div>
</template>
