import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;
  const { data, error } = await supabase
    .from("prompt_items")
    .select("*")
    .order("sort_order");
  if (error) throw createError({ statusCode: 500, message: error.message });
  return (data ?? []) as Record<string, unknown>[];
});
