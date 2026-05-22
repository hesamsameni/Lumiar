import { createClient } from "@supabase/supabase-js";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ code: string }>(event);
  const code = body?.code?.trim();
  if (!code) throw createError({ statusCode: 400, message: "Missing referral code" });

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

  const { data, error } = await supabase.rpc("claim_referral", {
    p_referral_code: code,
    p_referred_id: user.id,
  });

  if (error) throw createError({ statusCode: 500, message: error.message });

  return data as {
    ok: boolean;
    error?: string;
    credits_each?: number;
    referrer_id?: string;
  };
});
