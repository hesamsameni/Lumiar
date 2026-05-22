export interface ReferralStats {
  referral_count: number;
  credits_earned: number;
}

export function useReferral() {
  const { profile } = useProfile();
  const { session } = useAuthState();

  const referralLink = computed<string | null>(() => {
    const code = profile.value?.referral_code;
    if (!code) return null;
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://www.lumiar.site";
    return `${base}/join?ref=${code}`;
  });

  const stats = ref<ReferralStats | null>(null);
  const loadingStats = ref(false);

  async function fetchStats() {
    if (!session.value?.access_token) return;
    loadingStats.value = true;
    try {
      const data = await $fetch<ReferralStats>("/api/referrals/stats", {
        headers: { Authorization: `Bearer ${session.value.access_token}` },
      });
      stats.value = data;
    } catch {
      // silently ignore
    } finally {
      loadingStats.value = false;
    }
  }

  return { referralLink, stats, loadingStats, fetchStats };
}
