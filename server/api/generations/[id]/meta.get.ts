import { createClient } from "@supabase/supabase-js";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing id" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    (useRuntimeConfig().supabaseServiceRoleKey as string | undefined);

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({ statusCode: 500, message: "Server misconfiguration" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: gen, error } = await supabase
    .from("generations")
    .select("output_image_url, prompt, user_id")
    .eq("id", id)
    .single();

  if (error || !gen) {
    throw createError({ statusCode: 404, message: "Generation not found" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", gen.user_id)
    .single();

  return {
    imageUrl: gen.output_image_url as string,
    prompt: gen.prompt as string,
    username: (profile?.username as string) ?? null,
  };
});
