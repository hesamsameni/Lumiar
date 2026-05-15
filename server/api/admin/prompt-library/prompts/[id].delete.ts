import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const raw = getRouterParam(event, "id");
  if (!raw) throw createError({ statusCode: 400, message: "Missing id" });
  const id = decodeURIComponent(raw);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;
  const { error } = await supabase
    .from("prompt_items")
    .delete()
    .eq("id", id);
  if (error) throw createError({ statusCode: 500, message: error.message });
  return { success: true };
});
