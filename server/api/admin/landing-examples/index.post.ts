import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { use_case_slug, image_url, caption, link_url, sort_order, is_active } =
    body ?? {};

  if (
    typeof use_case_slug !== "string" ||
    !use_case_slug.trim() ||
    typeof image_url !== "string" ||
    !image_url.trim()
  ) {
    throw createError({
      statusCode: 400,
      message: "use_case_slug and image_url are required",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;

  const { data, error } = await supabase
    .from("landing_page_examples")
    .insert({
      use_case_slug: use_case_slug.trim(),
      image_url: image_url.trim(),
      caption: typeof caption === "string" ? caption.trim() || null : null,
      link_url: typeof link_url === "string" ? link_url.trim() || null : null,
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      is_active: is_active === undefined ? true : Boolean(is_active),
    })
    .select()
    .single();

  if (error) throw createError({ statusCode: 500, message: error.message });

  return data;
});
