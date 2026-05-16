// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface BunnyConfig {
  cdnUrl: string;
  storageHostname: string;
  storageZone: string;
  accessKey: string;
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
 * Falls back to the Bunny storage API when the CDN returns a non-OK response.
 */
export async function resolveInputImageBase64(
  inputImageBase64: string | null,
  inputImageUrl: string | null,
  requestHeaders?: Record<string, string>,
  bunnyConfig?: BunnyConfig,
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

  if (!response.ok && bunnyConfig) {
    const inputUrl = new URL(inputImageUrl);
    const cdnOrigin = bunnyConfig.cdnUrl.startsWith("http")
      ? new URL(bunnyConfig.cdnUrl)
      : new URL(`https://${bunnyConfig.cdnUrl}`);

    if (inputUrl.host === cdnOrigin.host) {
      const inputPath = inputUrl.pathname.replace(/^\/+/, "");
      const storageUrl = `https://${bunnyConfig.storageHostname}/${bunnyConfig.storageZone}/${inputPath}`;
      response = await fetch(storageUrl, {
        headers: { AccessKey: bunnyConfig.accessKey },
      });
    }
  }

  if (!response.ok) throw new Error("Failed to fetch input image");

  const contentType = response.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/"))
    throw new Error("Input URL did not return an image");

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}
