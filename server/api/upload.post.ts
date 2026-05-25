import {
  buildCdnUrl,
  deleteFromR2,
  generateStorageFilename,
  uploadToR2,
} from "../utils/r2";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FOLDER_MAP: Record<string, string> = {
  generations: "lumiar-original-images",
  "profile-pictures": "lumiar-profile-pics",
};
const ALLOWED_FOLDERS = Object.keys(FOLDER_MAP) as string[];

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const user = await requireUser(event);

  const { folder: folderParam, oldUrl } = getQuery(event) as {
    folder?: string;
    oldUrl?: string;
  };
  const folderKey =
    folderParam && ALLOWED_FOLDERS.includes(folderParam)
      ? folderParam
      : "generations";
  const folder = FOLDER_MAP[folderKey]!;

  const formData = await readFormData(event);
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw createError({ statusCode: 400, message: "No file provided" });
  }
  if (!(file.type in ALLOWED_MIME_TYPES)) {
    throw createError({ statusCode: 400, message: "Unsupported file type" });
  }
  if (file.size > MAX_FILE_BYTES) {
    throw createError({
      statusCode: 400,
      message: "File too large (max 10MB)",
    });
  }

  const ext = ALLOWED_MIME_TYPES[file.type] ?? "png";
  const path = `${folder}/${user.id}/${generateStorageFilename(ext)}`;

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
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    throw createError({ statusCode: 500, message: msg });
  }

  const newUrl = buildCdnUrl(config.public.r2PublicUrl as string, path);

  if (oldUrl) {
    const cdnBase = buildCdnUrl(config.public.r2PublicUrl as string, "");
    if (oldUrl.startsWith(cdnBase)) {
      const oldPath = oldUrl.slice(cdnBase.length);
      deleteFromR2(
        {
          cdnUrl: String(config.public.r2PublicUrl),
          accountId: String(config.r2AccountId),
          accessKeyId: String(config.r2AccessKeyId),
          secretAccessKey: String(config.r2SecretAccessKey),
          bucketName: String(config.r2BucketName),
        },
        oldPath,
      ).catch((err) =>
        console.error("[upload] old R2 object delete failed (non-fatal):", err),
      );
    }
  }

  return { url: newUrl, path };
});
