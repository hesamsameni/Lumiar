import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const raw = getRouterParam(event, "id");
  if (!raw) {
    throw createError({ statusCode: 400, message: "Missing model id" });
  }
  const id = decodeURIComponent(raw);

  const supabase = await serverSupabaseClient(event);

  const { error } = await supabase.from("video_models").delete().eq("id", id);

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return { success: true };
});
