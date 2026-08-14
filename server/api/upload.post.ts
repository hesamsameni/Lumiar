import {
  buildCdnUrl,
  deleteFromR2,
  generateStorageFilename,
  uploadToR2,
} from "../utils/r2";

const IMAGE_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const VIDEO_MIME_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const AUDIO_MIME_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
};

const ALL_MIME_TYPES: Record<string, string> = {
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB

const FOLDER_MAP: Record<string, string> = {
  generations: "lumiar-original-images",
  "profile-pictures": "lumiar-profile-pics",
  "tmp-video": "tmp-video",
  "tmp-audio": "tmp-audio",
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
  if (!(file.type in ALL_MIME_TYPES)) {
    throw createError({ statusCode: 400, message: "Unsupported file type" });
  }

  // Determine media category and enforce per-category size limits.
  const isVideo = file.type in VIDEO_MIME_TYPES;
  const isAudio = file.type in AUDIO_MIME_TYPES;
  const maxBytes = isVideo
    ? MAX_VIDEO_BYTES
    : isAudio
      ? MAX_AUDIO_BYTES
      : MAX_IMAGE_BYTES;
  const maxLabel = isVideo ? "100MB" : isAudio ? "20MB" : "10MB";
  if (file.size > maxBytes) {
    throw createError({
      statusCode: 400,
      message: `File too large (max ${maxLabel})`,
    });
  }

  const ext = ALL_MIME_TYPES[file.type] ?? "bin";
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
      file.type,
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
