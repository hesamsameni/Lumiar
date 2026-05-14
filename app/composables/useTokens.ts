import { useProfileService } from "~/services/profile.service";

// Consider creating a token.service.ts for token-specific logic if it grows

export function useTokens() {
  const { profile, fetchProfile } = useProfile();
  const profileService = useProfileService();

  const balance = computed(() => profile.value?.token_balance ?? null);

  async function fetchBalance() {
    await fetchProfile();
  }

  /**
   * Deduct tokens from the current user and log the transaction.
   * All DB logic is handled in the profileService.
   */
  async function deductTokens(
    amount: number,
    generationId: string,
    description: string,
  ) {
    if (!profile.value?.id) throw new Error("Not authenticated");
    const { error } = await profileService.deductTokens({
      userId: profile.value.id,
      username: profile.value.username,
      full_name: profile.value.full_name,
      bio: profile.value.bio,
      amount,
      generationId,
      description,
    });
    if (error) throw error;
    // Refresh profile state
    await fetchProfile();
  }

  return { balance, fetchBalance, deductTokens };
}
