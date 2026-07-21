import { deleteFromR2, type R2Config } from "../../utils/r2";

// Input images uploaded from the composer live under this folder (see
// FOLDER_MAP in /api/upload).
const UPLOAD_FOLDER = "lumiar-original-images";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const user = await requireUser(event);

  const body = await readBody<{ key?: string }>(event);
  const key = body?.key?.trim();

  if (!key) {
    throw createError({ statusCode: 400, message: "Missing asset key" });
  }

  // Only allow deleting objects inside the requesting user's own folder.
  const ownerPrefix = `${UPLOAD_FOLDER}/${user.id}/`;
  if (!key.startsWith(ownerPrefix)) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const r2Config: R2Config = {
    cdnUrl: String(config.public.r2PublicUrl),
    accountId: String(config.r2AccountId),
    accessKeyId: String(config.r2AccessKeyId),
    secretAccessKey: String(config.r2SecretAccessKey),
    bucketName: String(config.r2BucketName),
  };

  await deleteFromR2(r2Config, key);
  return { success: true };
});
