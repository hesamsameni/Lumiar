import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const query = getQuery(event);
  const slug = typeof query.slug === "string" ? query.slug.trim() : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;

  let q = supabase
    .from("landing_page_examples")
    .select("*")
    .order("use_case_slug", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (slug) q = q.eq("use_case_slug", slug);

  const { data, error } = await q;

  if (error) throw createError({ statusCode: 500, message: error.message });

  return data ?? [];
});
