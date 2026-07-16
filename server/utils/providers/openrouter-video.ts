// OpenRouter async video generation.
// Docs: https://openrouter.ai/docs/guides/overview/multimodal/video-generation
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const COMMON_HEADERS = {
  "HTTP-Referer": "https://www.lumiar.site",
  "X-Title": "Lumiar",
};

export type VideoJobStatus =
  | "pending"
  | "in_progress"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type VideoImageMode = "frame" | "reference";

export interface SubmitVideoParams {
  model: string;
  prompt: string;
  durationSeconds?: number;
  resolution?: string;
  aspectRatio?: string;
  // Public URLs of the input images. `frame_images` (first/last) are exact frame
  // anchors (image-to-video); `input_references` guide style/content
  // (reference-to-video). If both are sent, OpenRouter treats it as
  // image-to-video (frames take precedence).
  firstFrameImageUrl?: string | null;
  lastFrameImageUrl?: string | null;
  referenceImageUrl?: string | null;
}

export interface SubmitVideoResult {
  id: string;
  polling_url?: string;
  status: VideoJobStatus;
}

export interface PollVideoResult {
  id: string;
  generation_id?: string | null;
  status: VideoJobStatus;
  unsigned_urls?: string[];
  usage?: { cost?: number; is_byok?: boolean };
  error?: string | null;
}

export async function submitVideoJob(
  apiKey: string,
  params: SubmitVideoParams,
): Promise<SubmitVideoResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
  };
  if (params.durationSeconds) body.duration = params.durationSeconds;
  if (params.resolution) body.resolution = params.resolution;
  if (params.aspectRatio) body.aspect_ratio = params.aspectRatio;

  // Image-to-video: exact first/last frame anchors.
  const frameImages: Array<Record<string, unknown>> = [];
  if (params.firstFrameImageUrl) {
    frameImages.push({
      type: "image_url",
      image_url: { url: params.firstFrameImageUrl },
      frame_type: "first_frame",
    });
  }
  if (params.lastFrameImageUrl) {
    frameImages.push({
      type: "image_url",
      image_url: { url: params.lastFrameImageUrl },
      frame_type: "last_frame",
    });
  }
  if (frameImages.length) body.frame_images = frameImages;

  // Reference-to-video: style/content guidance (not an exact frame).
  if (params.referenceImageUrl) {
    body.input_references = [
      { type: "image_url", image_url: { url: params.referenceImageUrl } },
    ];
  }

  const res = await fetch(`${OPENROUTER_BASE}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...COMMON_HEADERS,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter video submit failed (${res.status}): ${text.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as SubmitVideoResult;
  if (!json?.id) {
    throw new Error("OpenRouter video submit returned no job id");
  }
  return json;
}

export async function pollVideoJob(
  apiKey: string,
  jobId: string,
): Promise<PollVideoResult> {
  const res = await fetch(
    `${OPENROUTER_BASE}/videos/${encodeURIComponent(jobId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...COMMON_HEADERS,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter video poll failed (${res.status}): ${text.slice(0, 500)}`,
    );
  }

  return (await res.json()) as PollVideoResult;
}

// Downloads the finished clip. `unsigned_urls[0]` points at OpenRouter's content
// endpoint and requires the API key.
export async function downloadVideo(
  apiKey: string,
  contentUrl: string,
): Promise<Buffer> {
  const res = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, ...COMMON_HEADERS },
  });
  if (!res.ok) {
    throw new Error(`Failed to download video (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function isTerminalFailure(status: VideoJobStatus): boolean {
  return status === "failed" || status === "cancelled" || status === "expired";
}
