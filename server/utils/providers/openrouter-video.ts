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

// Maps model-ID prefixes to the provider slug used in `provider.options`.
// Only models whose providers expose useful passthrough parameters need entries.
const PROVIDER_SLUG_MAP: Record<string, string> = {
  "google/": "google-vertex",
  "alibaba/": "atlas-cloud",
  // Note: ByteDance/Seedance models only expose "watermark" and "req_key" as
  // passthrough params. Real-person detection is a hard block with no toggle.
};

function providerSlugForModel(modelId: string): string | null {
  for (const [prefix, slug] of Object.entries(PROVIDER_SLUG_MAP)) {
    if (modelId.startsWith(prefix)) return slug;
  }
  return null;
}

// Default provider-specific parameters sent automatically for every job.
// These let us e.g. unlock person generation on Google Vertex without the user
// having to toggle anything.
const DEFAULT_PROVIDER_OPTIONS: Record<string, Record<string, unknown>> = {
  "google-vertex": {
    parameters: {
      personGeneration: "allow_all",
    },
  },
};

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
  // Unified reference pool: images and/or videos that guide the generation.
  // Each item is sent as an input_reference with the appropriate type.
  references?: { url: string; mediaType: "image" | "video" }[];
  // Public URL of an input audio track (lip-sync / audio-driven). Sent as an
  // input_reference with type "audio_url".
  inputAudioUrl?: string | null;
  // Whether to enable synchronized audio generation (when the model supports it).
  generateAudio?: boolean;
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

  // Reference inputs: images, videos, and/or audio that guide the generation.
  const inputRefs: Array<Record<string, unknown>> = [];
  if (params.references?.length) {
    for (const ref of params.references) {
      if (ref.mediaType === "video") {
        inputRefs.push({
          type: "video_url",
          video_url: { url: ref.url },
        });
      } else {
        inputRefs.push({
          type: "image_url",
          image_url: { url: ref.url },
        });
      }
    }
  }
  if (params.inputAudioUrl) {
    inputRefs.push({
      type: "audio_url",
      audio_url: { url: params.inputAudioUrl },
    });
  }
  if (inputRefs.length) body.input_references = inputRefs;

  // Synchronized audio generation.
  if (params.generateAudio) body.generate_audio = true;

  // Provider-specific passthrough options (e.g. personGeneration for Google).
  const slug = providerSlugForModel(params.model);
  if (slug && DEFAULT_PROVIDER_OPTIONS[slug]) {
    body.provider = {
      options: {
        [slug]: DEFAULT_PROVIDER_OPTIONS[slug],
      },
    };
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
