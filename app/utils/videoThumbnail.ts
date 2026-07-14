// Captures a single frame from a video URL as a JPEG blob, entirely in the
// browser. Requires the video to be served with CORS (crossorigin anonymous),
// otherwise the canvas is tainted and this resolves null. Best-effort: any
// failure resolves null so callers can fall back to a placeholder.
export function captureVideoFrame(
  url: string,
  seekSeconds = 0.1,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      try {
        video.src = "";
      } catch {
        // ignore
      }
      resolve(blob);
    };

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    // Give up after a while so we never hang the caller.
    const timeout = setTimeout(() => finish(null), 10_000);

    function capture() {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) {
          clearTimeout(timeout);
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            clearTimeout(timeout);
            finish(blob);
          },
          "image/jpeg",
          0.82,
        );
      } catch {
        clearTimeout(timeout);
        finish(null);
      }
    }

    video.addEventListener("error", () => {
      clearTimeout(timeout);
      finish(null);
    });

    video.addEventListener(
      "loadeddata",
      () => {
        const target = Math.min(
          seekSeconds,
          Math.max(0, (video.duration || 1) * 0.1),
        );
        video.addEventListener("seeked", capture, { once: true });
        try {
          video.currentTime = target || 0.1;
        } catch {
          capture();
        }
      },
      { once: true },
    );

    video.src = url;
  });
}
