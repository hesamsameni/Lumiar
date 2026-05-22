import { createClient } from "@supabase/supabase-js";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

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

  const { count, error } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", user.id)
    .not("credits_awarded_at", "is", null);

  if (error) throw createError({ statusCode: 500, message: error.message });

  const total = count ?? 0;
  return {
    referral_count: total,
    credits_earned: total * 50,
  };
});
