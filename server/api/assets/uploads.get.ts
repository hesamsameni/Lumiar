import { listFromR2, type R2Config } from "../../utils/r2";

// Input images uploaded from the composer land under this folder (see
// FOLDER_MAP in /api/upload). We list the current user's own folder only.
const UPLOAD_FOLDER = "lumiar-original-images";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const user = await requireUser(event);

  const r2Config: R2Config = {
    cdnUrl: String(config.public.r2PublicUrl),
    accountId: String(config.r2AccountId),
    accessKeyId: String(config.r2AccessKeyId),
    secretAccessKey: String(config.r2SecretAccessKey),
    bucketName: String(config.r2BucketName),
  };

  try {
    const objects = await listFromR2(
      r2Config,
      `${UPLOAD_FOLDER}/${user.id}/`,
    );
    return { assets: objects };
  } catch {
    throw createError({
      statusCode: 500,
      message: "Failed to list uploaded assets",
    });
  }
});
