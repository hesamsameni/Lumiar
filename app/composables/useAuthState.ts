import type { Session, User } from "@supabase/supabase-js";

export function useAuthState() {
  const session = useState<Session | null>("auth-session", () => null);
  const ready = useState<boolean>("auth-ready", () => false);

  const user = computed<User | null>(() => session.value?.user ?? null);
  const isAuthenticated = computed(() => Boolean(user.value?.id));

  return {
    session,
    user,
    ready,
    isAuthenticated,
  };
}
