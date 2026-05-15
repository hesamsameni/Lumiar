import { requireAdmin } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const config = useRuntimeConfig();
  const formData = await readFormData(event);
  const file = formData.get("file") as File | null;
  const promptId = (formData.get("promptId") as string | null) ?? "misc";

  if (!file) throw createError({ statusCode: 400, message: "No file provided" });

  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedMimeTypes.has(file.type)) {
    throw createError({ statusCode: 400, message: "Unsupported file type" });
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw createError({ statusCode: 400, message: "File too large (max 10MB)" });
  }

  const extByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extByMime[file.type] ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `prompt-library/${promptId}/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadUrl = `https://${config.bunnyStorageHostname}/${config.bunnyStorageZone}/${path}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: config.bunnyApiKey,
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[prompt-img upload] Bunny HTTP ${response.status} — ${body}`);
    throw createError({
      statusCode: 500,
      message: `Bunny.net upload failed (HTTP ${response.status})`,
    });
  }

  const cdnBase = config.public.bunnyCdnUrl.replace(/\/+$/, "");
  const cdnUrl = cdnBase.startsWith("http")
    ? `${cdnBase}/${path}`
    : `https://${cdnBase}/${path}`;

  return { url: cdnUrl };
});
