import { serverSupabaseClient } from "#supabase/server";

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  const [{ data: cats, error: catErr }, { data: prompts, error: promptErr }] =
    await Promise.all([
      supabase
        .from("prompt_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("prompt_items")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  if (catErr) throw createError({ statusCode: 500, message: catErr.message });
  if (promptErr)
    throw createError({ statusCode: 500, message: promptErr.message });

  const catList = (cats ?? []) as Record<string, unknown>[];
  const promptList = (prompts ?? []) as Record<string, unknown>[];

  return catList.map((cat) => ({
    ...cat,
    prompts: promptList.filter((p) => p.category_id === cat.id),
  }));
});
