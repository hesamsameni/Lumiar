import { useAuthService } from "~/services/auth.service";
import { useProfileService } from "~/services/profile.service";

export interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  token_balance: number;
}

export function useProfile() {
  const user = useSupabaseUser();
  const session = useSupabaseSession();
  const authService = useAuthService();
  const profileService = useProfileService();

  const profile = useState<UserProfile | null>("current-profile", () => null);
  const loading = useState<boolean>("profile-loading", () => false);
  const initialized = useState<boolean>("profile-initialized", () => false);

  async function fetchProfile() {
    const authUser = user.value?.id
      ? user.value
      : await authService.getCurrentUser();

    if (!authUser?.id) {
      profile.value = null;
      return;
    }

    loading.value = true;
    const { data, error } = await profileService.getProfileById(authUser.id);

    if (error) {
      loading.value = false;
      return;
    }

    if (data) {
      profile.value = data as UserProfile;
      loading.value = false;
      return;
    }

    const { data: createdProfile } = await profileService.ensureProfileForUser({
      id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata,
    });

    if (createdProfile) {
      profile.value = createdProfile as UserProfile;
    }

    loading.value = false;
  }

  if (!initialized.value) {
    initialized.value = true;
    watch(
      [() => user.value?.id, () => Boolean(session.value)],
      ([userId, hasSession]) => {
        if (userId || hasSession) fetchProfile();
        else profile.value = null;
      },
      { immediate: true },
    );
  }

  return { profile, loading, fetchProfile };
}
