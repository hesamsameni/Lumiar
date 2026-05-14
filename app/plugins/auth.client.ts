/**
 * Client plugin — bootstraps profile state and keeps it in sync with auth.
 *
 * This plugin is async. Nuxt awaits all async plugins before mounting the app,
 * so awaiting fetchProfile() here guarantees the header renders correctly on
 * the very first paint — no "logged out" flash for authenticated users.
 */
export default defineNuxtPlugin(async () => {
  const supabase = useSupabaseClient();
  const { session, ready } = useAuthState();
  const { profile, fetchProfile } = useProfile();

  // The @nuxtjs/supabase module has already called getSession() in its own
  // plugin (which runs before user plugins). By this point the session is
  // resolved and available synchronously.
  const {
    data: { session: initialSession },
  } = await supabase.auth.getSession();

  session.value = initialSession ?? null;

  if (initialSession?.user) {
    // ALWAYS await here — this is what prevents the "logged out" flash.
    // The plugin does not resolve until the profile is actually in state.
    if (profile.value?.id !== initialSession.user.id) {
      await fetchProfile();
    }
  } else {
    profile.value = null;
  }

  ready.value = true;

  // Handle future auth events: sign-in (after login page), sign-out, refresh.
  supabase.auth.onAuthStateChange(async (event, nextSession) => {
    session.value = nextSession ?? null;

    if (event === "SIGNED_OUT") {
      profile.value = null;
    } else if (nextSession?.user) {
      if (profile.value?.id !== nextSession.user.id) {
        await fetchProfile();
      }
    }
  });
});
