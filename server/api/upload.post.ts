import {
  buildCdnUrl,
  generateStorageFilename,
  uploadToBunny,
} from "../utils/bunny";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FOLDERS = ["generations", "profile-pictures"] as const;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const user = await requireUser(event);

  const { folder: folderParam } = getQuery(event) as { folder?: string };
  const folder = ALLOWED_FOLDERS.includes(folderParam as never)
    ? (folderParam as string)
    : "generations";

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
    await uploadToBunny(
      config.bunnyStorageHostname as string,
      config.bunnyStorageZone as string,
      config.bunnyApiKey as string,
      path,
      buffer,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    throw createError({ statusCode: 500, message: msg });
  }

  return { url: buildCdnUrl(config.public.bunnyCdnUrl as string, path), path };
});
