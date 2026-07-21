// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface StorageConfig {
  cdnUrl: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

function isSafeUrl(url: URL): boolean {
  const { hostname } = url;
  if (
    ["localhost", "0.0.0.0", "::1", "[::1]"].includes(hostname.toLowerCase())
  ) {
    return false;
  }
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Input image resolution
// ---------------------------------------------------------------------------

/**
 * Resolves an input image to a base64 data URI.
 * Prefers a pre-supplied base64 string, then fetches the URL.
 * R2 public buckets are always publicly readable, so a plain CDN fetch suffices.
 */
export async function resolveInputImageBase64(
  inputImageBase64: string | null,
  inputImageUrl: string | null,
  requestHeaders?: Record<string, string>,
  _storageConfig?: StorageConfig,
): Promise<string | null> {
  if (inputImageBase64) return inputImageBase64;
  if (!inputImageUrl) return null;

  const parsedUrl = new URL(inputImageUrl);
  if (!isSafeUrl(parsedUrl)) {
    throw new Error("Unsafe input image URL");
  }

  let response: Response;
  try {
    response = await fetch(inputImageUrl, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
        ...(requestHeaders ?? {}),
      },
    });
  } catch {
    response = new Response(null, { status: 599 });
  }

  if (!response.ok) throw new Error("Failed to fetch input image");

  const rawContentType = (
    response.headers.get("content-type") ?? ""
  ).toLowerCase();

  // R2 objects uploaded without an explicit content-type are served as
  // `application/octet-stream`, so fall back to the URL's file extension.
  const mimeByExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  let contentType = rawContentType;
  if (!contentType.startsWith("image/")) {
    const ext = parsedUrl.pathname.split(".").pop()?.toLowerCase() ?? "";
    const byExt = mimeByExt[ext];
    if (byExt) {
      contentType = byExt;
    } else if (
      rawContentType === "" ||
      rawContentType.startsWith("application/octet-stream") ||
      rawContentType.startsWith("binary/")
    ) {
      // Unknown but generic binary — assume JPEG (our uploads are validated
      // to be jpg/png/webp on the way in).
      contentType = "image/jpeg";
    } else {
      throw new Error("Input URL did not return an image");
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}
