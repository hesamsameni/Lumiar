import { createClient } from "@supabase/supabase-js";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const userId = getRouterParam(event, "id");
  if (!userId) throw createError({ statusCode: 400, message: "Missing id" });

  const body = await readBody<{ credits: number }>(event);
  const credits = Number(body?.credits);

  if (!Number.isFinite(credits) || credits <= 0 || !Number.isInteger(credits)) {
    throw createError({
      statusCode: 400,
      message: "credits must be a positive integer",
    });
  }

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

  const { error: txError } = await (supabase as any)
    .from("token_transactions")
    .insert({
      user_id: userId,
      amount: credits,
      type: "purchase",
      description: "admin_grant",
    });

  if (txError) {
    throw createError({ statusCode: 500, message: txError.message });
  }

  const { error: rpcError } = await supabase.rpc("add_tokens_to_user", {
    p_user_id: userId,
    p_amount: credits,
  });

  if (rpcError) {
    throw createError({ statusCode: 500, message: rpcError.message });
  }

  return { success: true };
});
