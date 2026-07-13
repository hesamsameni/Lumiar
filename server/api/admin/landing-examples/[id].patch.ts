import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../utils/auth";

const ALLOWED_FIELDS = [
  "image_url",
  "caption",
  "link_url",
  "sort_order",
  "is_active",
  "use_case_slug",
] as const;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing id" });

  const body = (await readBody(event)) ?? {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) patch[key] = body[key];
  }
  patch.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;

  const { data, error } = await supabase
    .from("landing_page_examples")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw createError({ statusCode: 500, message: error.message });

  return data;
});
