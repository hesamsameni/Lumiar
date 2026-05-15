export function buildCdnUrl(cdnBase: string, path: string): string {
  const base = cdnBase.replace(/\/+$/, "");
  return base.startsWith("http")
    ? `${base}/${path}`
    : `https://${base}/${path}`;
}

export function generateStorageFilename(ext: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

export async function uploadToBunny(
  storageHostname: string,
  storageZone: string,
  accessKey: string,
  path: string,
  buffer: Buffer,
): Promise<void> {
  const uploadUrl = `https://${storageHostname}/${storageZone}/${path}`;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: accessKey,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(buffer),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      `[Bunny] Upload failed: HTTP ${response.status} — ${uploadUrl} — ${body}`,
    );
    throw new Error(`Bunny.net upload failed (HTTP ${response.status})`);
  }
}

export async function deleteFromBunny(
  storageHostname: string,
  storageZone: string,
  accessKey: string,
  path: string,
): Promise<void> {
  const deleteUrl = `https://${storageHostname}/${storageZone}/${path}`;
  await fetch(deleteUrl, {
    method: "DELETE",
    headers: { AccessKey: accessKey },
  });
}
