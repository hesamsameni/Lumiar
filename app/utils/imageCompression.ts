const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

/**
 * Converts a HEIC/HEIF file to JPEG using heic-to (browser-only).
 * Returns the original file if it is not HEIC/HEIF.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!HEIC_TYPES.has(file.type)) return file;

  try {
    // Dynamic import so the module is never evaluated during SSR
    const { heicTo } = await import("heic-to");
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
    const outBlob = Array.isArray(blob) ? blob[0]! : blob;
    return new File([outBlob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch (err) {
    console.error("HEIC conversion failed:", err);
    throw new Error(
      "Failed to convert HEIC photo. Please convert it to JPEG manually (e.g. share from Photos app as JPEG).",
    );
  }
}

/**
 * Compresses an image File using an off-screen canvas.
 * Automatically converts HEIC/HEIF to JPEG first.
 *
 * Falls back to the (possibly converted) file if the browser cannot draw
 * it on a canvas or if any other error occurs.
 *
 * @param file     - The source image File (JPEG, PNG, WebP, HEIC …).
 * @param maxPx    - Maximum width or height in pixels (default 2048).
 * @param quality  - JPEG encoding quality 0-1 (default 0.85).
 * @returns A compressed File (image/jpeg), or best-effort fallback.
 */
export async function compressImage(
  file: File,
  maxPx = 2048,
  quality = 0.85,
): Promise<File> {
  // Convert HEIC/HEIF → JPEG first so the canvas can decode it
  const source = await convertHeicToJpeg(file);

  // Skip canvas compression for already-small files
  if (source.size < 200 * 1024) return source;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(source);

    const cleanup = () => URL.revokeObjectURL(url);

    img.onload = () => {
      cleanup();
      try {
        const scale = Math.min(
          1,
          maxPx / img.naturalWidth,
          maxPx / img.naturalHeight,
        );
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(source);
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(source);
            resolve(
              new File([blob], source.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
              }),
            );
          },
          "image/jpeg",
          quality,
        );
      } catch {
        resolve(source);
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(source);
    };

    img.src = url;
  });
}
