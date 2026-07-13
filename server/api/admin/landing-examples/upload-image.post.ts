import { requireAdmin } from "../../../utils/auth";
import {
  buildCdnUrl,
  generateStorageFilename,
  uploadToR2,
} from "../../../utils/r2";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const config = useRuntimeConfig();
  const formData = await readFormData(event);
  const file = formData.get("file") as File | null;
  const rawSlug = (formData.get("slug") as string | null) ?? "misc";
  const slug = rawSlug.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "misc";

  if (!file)
    throw createError({ statusCode: 400, message: "No file provided" });
  if (!(file.type in ALLOWED_MIME_TYPES)) {
    throw createError({ statusCode: 400, message: "Unsupported file type" });
  }
  if (file.size > MAX_FILE_BYTES) {
    throw createError({ statusCode: 400, message: "File too large (max 10MB)" });
  }

  const ext = ALLOWED_MIME_TYPES[file.type] ?? "jpg";
  const path = `lumiar-landing/${slug}/${generateStorageFilename(ext)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadToR2(
      {
        cdnUrl: String(config.public.r2PublicUrl),
        accountId: String(config.r2AccountId),
        accessKeyId: String(config.r2AccessKeyId),
        secretAccessKey: String(config.r2SecretAccessKey),
        bucketName: String(config.r2BucketName),
      },
      path,
      buffer,
      file.type,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    throw createError({ statusCode: 500, message: msg });
  }

  return { url: buildCdnUrl(config.public.r2PublicUrl as string, path) };
});
