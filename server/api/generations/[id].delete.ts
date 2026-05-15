import { serverSupabaseClient } from "#supabase/server";
import { requireUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing id" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;

  const { data: gen, error: fetchErr } = await supabase
    .from("generations")
    .select("user_id, output_image_url")
    .eq("id", id)
    .single();

  if (fetchErr || !gen) {
    throw createError({ statusCode: 404, message: "Generation not found" });
  }
  if (gen.user_id !== user.id) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const { error: deleteErr } = await supabase
    .from("generations")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    throw createError({ statusCode: 500, message: deleteErr.message });
  }

  const config = useRuntimeConfig();
  try {
    const cdnBase = (config.public.bunnyCdnUrl as string).replace(/\/+$/, "");
    const cdnBaseWithScheme = cdnBase.startsWith("http")
      ? cdnBase
      : `https://${cdnBase}`;
    const imageUrl = gen.output_image_url as string;
    if (imageUrl.startsWith(cdnBaseWithScheme)) {
      const path = imageUrl.slice(cdnBaseWithScheme.length + 1);
      const deleteUrl = `https://${config.bunnyStorageHostname}/${config.bunnyStorageZone}/${path}`;
      await fetch(deleteUrl, {
        method: "DELETE",
        headers: { AccessKey: config.bunnyApiKey as string },
      });
    }
  } catch (err) {
    console.error("[delete generation] Bunny delete failed (non-fatal):", err);
  }

  return { success: true };
});
