import OpenAI, { toFile } from "openai";

// Sizes for gpt-image-1 / gpt-image-1.5 / gpt-image-1-mini.
// These models accept ONLY three sizes (1024x1024, 1536x1024, 1024x1536), so we
// clamp every aspect ratio to the nearest valid orientation. (gpt-image-2 uses
// the flexible map below.)
export const ASPECT_RATIO_TO_OPENAI_SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1536x1024",
  "3:4": "1024x1536",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

// gpt-image-2 accepts any WxH where both edges are multiples of 16px.
// 1365 is not a multiple of 16, so we need corrected values for 4:3 / 3:4.
// 1536x1152 = exactly 4:3; 1152x1536 = exactly 3:4.
const ASPECT_RATIO_TO_GPT_IMAGE_2_SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1536x1152",
  "3:4": "1152x1536",
  "16:9": "1792x1008",
  "9:16": "1008x1792",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export async function generateWithOpenAI(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  inputImagesBase64: string[],
  // Optional native `quality` (e.g. "low" | "medium" | "high"); omitted -> API default.
  quality?: string | null,
): Promise<string> {
  const client = new OpenAI({ apiKey });

  const sizeMap =
    modelId === "gpt-image-2"
      ? ASPECT_RATIO_TO_GPT_IMAGE_2_SIZE
      : ASPECT_RATIO_TO_OPENAI_SIZE;
  const size = (sizeMap[aspectRatio] ?? "1024x1024") as Parameters<
    typeof client.images.generate
  >[0]["size"];

  const qualityOpt = quality
    ? { quality: quality as Parameters<typeof client.images.generate>[0]["quality"] }
    : {};

  console.log("[AI] OpenAI request", {
    provider: "openai",
    model: modelId,
    baseUrl: OPENAI_BASE_URL,
    mode: inputImagesBase64.length > 0 ? "edit" : "generate",
    imageCount: inputImagesBase64.length,
    size,
    quality: quality ?? "default",
  });

  if (inputImagesBase64.length > 0) {
    const imageFiles = await Promise.all(
      inputImagesBase64.map(async (b64, i) => {
        const raw = b64.replace(/^data:image\/[a-z]+;base64,/, "");
        const buf = Buffer.from(raw, "base64");
        return toFile(buf, `image${i}.png`, { type: "image/png" });
      }),
    );
    const res = await client.images.edit({
      model: modelId,
      image: imageFiles.length === 1 ? imageFiles[0]! : imageFiles,
      prompt,
      size,
      ...qualityOpt,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned by OpenAI");
    console.log("[AI] OpenAI response", {
      provider: "openai",
      model: modelId,
      usage: "n/a (billed per image)",
    });
    return `data:image/png;base64,${b64}`;
  }

  const res = await client.images.generate({
    model: modelId,
    prompt,
    size,
    ...qualityOpt,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned by OpenAI");
  console.log("[AI] OpenAI response", {
    provider: "openai",
    model: modelId,
    usage: "n/a (billed per image)",
  });
  return `data:image/png;base64,${b64}`;
}
