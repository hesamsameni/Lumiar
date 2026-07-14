import { serverSupabaseClient } from "#supabase/server";
import { buildCdnUrl, deleteFromR2 } from "../../utils/r2";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing id" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverSupabaseClient(event)) as any;

  const { data: gen, error: fetchErr } = await supabase
    .from("video_generations")
    .select("user_id, output_video_url")
    .eq("id", id)
    .single();

  if (fetchErr || !gen) {
    throw createError({ statusCode: 404, message: "Video not found" });
  }
  if (gen.user_id !== user.id) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const { error: deleteErr } = await supabase
    .from("video_generations")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    throw createError({ statusCode: 500, message: deleteErr.message });
  }

  const config = useRuntimeConfig();
  const r2Config = {
    cdnUrl: String(config.public.r2PublicUrl),
    accountId: String(config.r2AccountId),
    accessKeyId: String(config.r2AccessKeyId),
    secretAccessKey: String(config.r2SecretAccessKey),
    bucketName: String(config.r2BucketName),
  };
  const cdnBase = buildCdnUrl(config.public.r2PublicUrl as string, "");

  const videoUrl = gen.output_video_url as string | null;
  if (videoUrl?.startsWith(cdnBase)) {
    try {
      await deleteFromR2(r2Config, videoUrl.slice(cdnBase.length));
    } catch (err) {
      console.error("[delete video] R2 delete failed (non-fatal):", err);
    }
  }

  return { success: true };
});
