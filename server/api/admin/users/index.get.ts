import { createClient } from "@supabase/supabase-js";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const config = useRuntimeConfig();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    (config.supabaseServiceRoleKey as string | undefined);

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({ statusCode: 500, message: "Server misconfiguration" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const [profilesResult, countsResult] = await Promise.all([
    (supabase as any)
      .from("profiles")
      .select("id, username, full_name, avatar_url, token_balance, is_admin")
      .order("username", { ascending: true }),
    (supabase as any)
      .from("generations")
      .select("user_id")
      .then(
        ({
          data,
          error,
        }: {
          data: { user_id: string }[] | null;
          error: any;
        }) => {
          if (error) return { counts: {} as Record<string, number> };
          const counts: Record<string, number> = {};
          for (const row of data ?? []) {
            counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
          }
          return { counts };
        },
      ),
  ]);

  if (profilesResult.error) {
    throw createError({
      statusCode: 500,
      message: profilesResult.error.message,
    });
  }

  const generationCounts = countsResult.counts as Record<string, number>;

  return (profilesResult.data ?? []).map((p: any) => ({
    id: p.id,
    username: p.username,
    full_name: p.full_name as string | null,
    avatar_url: p.avatar_url as string | null,
    token_balance: p.token_balance as number,
    is_admin: p.is_admin as boolean,
    generation_count: generationCounts[p.id] ?? 0,
  }));
});
