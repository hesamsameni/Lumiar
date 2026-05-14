/**
 * Server plugin — runs once per SSR request.
 * Populates `profile` state on the server so the initial HTML is rendered
 * with the correct auth state (no flash of "logged out" on first load).
 *
 * useSupabaseUser() is populated server-side by the @nuxtjs/supabase module
 * reading the session cookie before our plugin runs.
 */
export default defineNuxtPlugin(async () => {
  const supabaseSession = useSupabaseSession();
  const user = useSupabaseUser();
  const { session, ready } = useAuthState();
  session.value = supabaseSession.value ?? null;
  ready.value = true;

  if (!user.value?.id) return;

  const { fetchProfile } = useProfile();
  // Always refresh — ensures the SSR payload has the latest profile data
  try {
    await fetchProfile();
  } catch {
    // Never let a profile fetch crash SSR
  }
});
