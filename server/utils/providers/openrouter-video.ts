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
  // Public URL of the input image.
  frameImageUrl?: string | null;
  // How the input image is used: "frame" = exact first frame (image-to-video),
  // "reference" = style/content guidance (reference-to-video).
  imageMode?: VideoImageMode;
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
  if (params.frameImageUrl) {
    if (params.imageMode === "reference") {
      // Reference-to-video: guide style/content without pinning an exact frame.
      body.input_references = [
        { type: "image_url", image_url: { url: params.frameImageUrl } },
      ];
    } else {
      // Image-to-video: the image is the first frame.
      body.frame_images = [
        {
          type: "image_url",
          image_url: { url: params.frameImageUrl },
          frame_type: "first_frame",
        },
      ];
    }
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
