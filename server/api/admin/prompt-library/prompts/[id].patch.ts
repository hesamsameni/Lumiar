import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const raw = getRouterParam(event, "id");
  if (!raw) throw createError({ statusCode: 400, message: "Missing id" });
  const id = decodeURIComponent(raw);
  const body = await readBody(event);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;
  const { data, error } = await supabase
    .from("prompt_items")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw createError({ statusCode: 500, message: error.message });
  return data;
});
