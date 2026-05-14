export interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  token_balance: number;
  is_admin: boolean;
}

export function useProfileService() {
  const supabase = useSupabaseClient();

  function sanitizeUsernamePart(value: string) {
    return value.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  function buildFallbackUsername(email?: string | null, id?: string) {
    const base = sanitizeUsernamePart(email?.split("@")[0] ?? "user");
    const suffix = id
      ? id.replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
    return `${base}_${suffix}`;
  }

  async function getProfileById(id: string) {
    return supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, bio, token_balance, is_admin",
      )
      .eq("id", id)
      .maybeSingle();
  }

  async function getProfileByUsername(username: string) {
    return supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, bio, token_balance, is_admin",
      )
      .eq("username", username)
      .maybeSingle();
  }

  async function getProfilesLiteByIds(userIds: string[]) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (!uniqueIds.length) return { data: [], error: null };

    return supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", uniqueIds);
  }

  async function ensureProfileForUser(user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  }) {
    const existing = await getProfileById(user.id);
    if (existing.error) return existing;
    if (existing.data) return existing;

    const username = buildFallbackUsername(user.email, user.id);

    return supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          username,
          full_name:
            (user.user_metadata?.full_name as string | undefined) ?? null,
          avatar_url:
            (user.user_metadata?.avatar_url as string | undefined) ?? null,
          bio: null,
          token_balance: 10,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "id" },
      )
      .select(
        "id, username, full_name, avatar_url, bio, token_balance, is_admin",
      )
      .single();
  }

  async function upsertProfile(input: {
    id: string;
    username: string;
    full_name: string | null;
    bio: string | null;
  }) {
    const username = sanitizeUsernamePart(input.username.trim());

    return supabase.from("profiles").upsert(
      {
        id: input.id,
        username,
        full_name: input.full_name,
        bio: input.bio,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "id" },
    );
  }

  /**
   * Deduct tokens from a user and log the transaction atomically.
   * This should be the only place token deduction logic lives.
   */
  async function deductTokens({
    userId,
    username,
    full_name,
    bio,
    amount,
    generationId,
    description,
  }: {
    userId: string;
    username: string;
    full_name: string | null;
    bio: string | null;
    amount: number;
    generationId: string;
    description: string;
  }) {
    // Fetch current balance
    const { data: profile, error: profileErr } = await getProfileById(userId);
    if (profileErr) return { error: profileErr };
    if (!profile) return { error: new Error("Profile not found") };
    const newBalance = (profile.token_balance ?? 0) - amount;
    // Update profile and insert transaction atomically
    const [{ error: balErr }, { error: txErr }, { error: updateErr }] =
      await Promise.all([
        upsertProfile({
          id: userId,
          username: username ?? "user",
          full_name: full_name ?? null,
          bio: bio ?? null,
        }),
        supabase.from("token_transactions").insert({
          user_id: userId,
          amount: -amount,
          type: "generation",
          reference_id: generationId,
          description,
        }),
        supabase
          .from("profiles")
          .update({
            token_balance: newBalance,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", userId),
      ]);
    return { error: balErr || txErr || updateErr || null };
  }

  return {
    getProfileById,
    getProfileByUsername,
    getProfilesLiteByIds,
    ensureProfileForUser,
    upsertProfile,
    sanitizeUsernamePart,
    deductTokens,
  };
}
