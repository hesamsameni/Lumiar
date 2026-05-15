import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const raw = getRouterParam(event, "id");
  if (!raw) {
    throw createError({ statusCode: 400, message: "Missing model id" });
  }
  const id = decodeURIComponent(raw);

  const body = await readBody(event);

  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from("ai_models")
    .update({ ...body, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return data;
});
