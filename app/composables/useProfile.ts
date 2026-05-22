import { useAuthService } from "~/services/auth.service";
import { useProfileService } from "~/services/profile.service";

export interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  token_balance: number;
  is_admin: boolean;
  default_model_id: string | null;
  referral_code: string | null;
}

/**
 * Global profile state composable.
 *
 * State is shared across all components via `useState` (Nuxt SSR-safe global
 * state). Auth lifecycle (initial load + sign-in/out events) is handled by
 * `plugins/auth.server.ts` and `plugins/auth.client.ts` — this composable
 * only owns state and the fetch logic.
 */
export function useProfile() {
  const { user } = useAuthState();
  const authService = useAuthService();
  const profileService = useProfileService();

  const profile = useState<UserProfile | null>("current-profile", () => null);
  const loading = useState<boolean>("profile-loading", () => false);

  async function fetchProfile() {
    // Prefer the reactive ref; fall back to a live getUser() call if needed
    const authUser = user.value ?? (await authService.getCurrentUser());

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
      const existing = data as UserProfile;

      // Backfill OAuth provider avatar (e.g. Google) when the profile row has
      // none yet. Uploaded avatars take priority because they overwrite
      // avatar_url, so this branch is skipped once the user has set their own.
      const oauthAvatar = authUser.user_metadata?.avatar_url as
        | string
        | undefined;
      if (!existing.avatar_url && oauthAvatar) {
        await profileService.upsertProfile({
          id: authUser.id,
          username: existing.username,
          full_name: existing.full_name,
          bio: existing.bio,
          avatar_url: oauthAvatar,
        });
        existing.avatar_url = oauthAvatar;
      }

      profile.value = existing;
      loading.value = false;
      return;
    }

    // Profile row doesn't exist yet — create it
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

  return { profile, loading, fetchProfile };
}
