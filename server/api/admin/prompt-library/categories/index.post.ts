import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readBody(event);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;
  const { data, error } = await supabase
    .from("prompt_categories")
    .insert(body)
    .select()
    .single();
  if (error) throw createError({ statusCode: 500, message: error.message });
  return data;
});
