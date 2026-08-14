import { serverSupabaseClient } from "#supabase/server";
import {
  pollVideoJob,
  downloadVideo,
  isTerminalFailure,
} from "../../../utils/providers/openrouter-video";
import {
  buildCdnUrl,
  deleteFromR2,
  generateStorageFilename,
  uploadToR2,
  type R2Config,
} from "../../../utils/r2";

interface VideoRow {
  id: string;
  user_id: string;
  job_id: string | null;
  status: string;
  output_video_url: string | null;
  input_video_url: string | null;
  input_audio_url: string | null;
  tokens_used: number;
  model_name: string;
  error: string | null;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const user = await requireUser(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id" });
  }

  const supabase = await serverSupabaseClient(event);

  const { data: rowRaw } = (await (supabase as any)
    .from("video_generations")
    .select(
      "id, user_id, job_id, status, output_video_url, input_video_url, input_audio_url, tokens_used, model_name, error",
    )
    .eq("id", id)
    .maybeSingle()) as { data: VideoRow | null };

  if (!rowRaw || rowRaw.user_id !== user.id) {
    throw createError({ statusCode: 404, message: "Not found" });
  }
  const row = rowRaw;

  // Already terminal — nothing to poll. (Idempotent: a stored URL means done,
  // even if the status column update was interrupted.)
  if (row.status === "completed" || row.output_video_url) {
    return {
      status: "completed",
      videoUrl: row.output_video_url,
      generationId: row.id,
    };
  }
  if (row.status === "failed") {
    return { status: "failed", error: row.error, generationId: row.id };
  }
  if (!row.job_id) {
    return { status: row.status, generationId: row.id };
  }

  const openrouterKey = config.openrouterApiKey as string;
  const r2Config: R2Config = {
    cdnUrl: String(config.public.r2PublicUrl),
    accountId: String(config.r2AccountId),
    accessKeyId: String(config.r2AccessKeyId),
    secretAccessKey: String(config.r2SecretAccessKey),
    bucketName: String(config.r2BucketName),
  };

  let poll;
  try {
    poll = await pollVideoJob(openrouterKey, row.job_id);
  } catch {
    // Transient poll error — keep the client polling.
    return { status: "processing", generationId: row.id };
  }

  // --- Completed: download and store to R2, then finalize the row ---
  if (poll.status === "completed" && poll.unsigned_urls?.length) {
    try {
      const buffer = await downloadVideo(openrouterKey, poll.unsigned_urls[0]!);
      const path = `lumiar-videos/${user.id}/${generateStorageFilename("mp4")}`;
      await uploadToR2(r2Config, path, buffer, "video/mp4");
      const videoUrl = buildCdnUrl(r2Config.cdnUrl, path);

      const { error: updateErr } = await (supabase as any)
        .from("video_generations")
        .update({
          status: "completed",
          output_video_url: videoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateErr) {
        console.error(
          "[video-status] Failed to mark video completed:",
          updateErr,
        );
      }

      // Clean up temp input video/audio from R2 (best-effort, non-blocking).
      cleanupTempInputs(r2Config, row);

      return { status: "completed", videoUrl, generationId: row.id };
    } catch (err) {
      console.error("[video-status] Failed to store completed video:", err);
      return { status: "processing", generationId: row.id };
    }
  }

  // --- Failed/expired/cancelled: refund reserved credits, mark failed ---
  if (isTerminalFailure(poll.status)) {
    const errMsg = poll.error ?? "Generation failed";
    if (row.tokens_used > 0) {
      try {
        await (supabase as any).rpc("add_tokens_to_user", {
          p_user_id: user.id,
          p_amount: row.tokens_used,
        });
        await (supabase as any).from("token_transactions").insert({
          user_id: user.id,
          amount: row.tokens_used,
          type: "refund",
          reference_id: row.id,
          description: `Refund: video failed (${row.model_name})`,
        });
      } catch (err) {
        console.error("[video-status] Refund failed (non-fatal):", err);
      }
    }

    await (supabase as any)
      .from("video_generations")
      .update({
        status: "failed",
        error: errMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    // Clean up temp input video/audio from R2 (best-effort, non-blocking).
    cleanupTempInputs(r2Config, row);

    return { status: "failed", error: errMsg, generationId: row.id };
  }

  // --- Still running ---
  if (row.status !== "processing") {
    await (supabase as any)
      .from("video_generations")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }
  return { status: "processing", generationId: row.id };
});

// Delete temporary input video/audio files from R2 once the generation is done.
// These live under `tmp-video/` or `tmp-audio/` prefixes and are only needed
// while OpenRouter fetches them during generation.
function cleanupTempInputs(r2Config: R2Config, row: VideoRow) {
  const cdnBase = buildCdnUrl(r2Config.cdnUrl, "");
  for (const url of [row.input_video_url, row.input_audio_url]) {
    if (!url || !url.startsWith(cdnBase)) continue;
    const path = url.slice(cdnBase.length);
    if (path.startsWith("tmp-video/") || path.startsWith("tmp-audio/")) {
      deleteFromR2(r2Config, path).catch((err) =>
        console.error(
          "[video-status] Temp input cleanup failed (non-fatal):",
          err,
        ),
      );
    }
  }
}
