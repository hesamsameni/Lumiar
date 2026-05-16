import OpenAI, { toFile } from "openai";

export const ASPECT_RATIO_TO_OPENAI_SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1365x1024",
  "3:4": "1024x1365",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

export const OPENAI_GPT_IMAGE_MODELS = new Set([
  "gpt-image-2",
  "gpt-image-1",
  "gpt-image-1-mini",
]);

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export async function generateWithOpenAI(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  inputImageBase64: string | null,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const size = (ASPECT_RATIO_TO_OPENAI_SIZE[aspectRatio] ??
    "1024x1024") as Parameters<typeof client.images.generate>[0]["size"];

  console.log("[AI] OpenAI request", {
    provider: "openai",
    model: modelId,
    baseUrl: OPENAI_BASE_URL,
    mode: inputImageBase64 ? "edit" : "generate",
    size,
  });

  if (inputImageBase64) {
    const rawBase64 = inputImageBase64.replace(
      /^data:image\/[a-z]+;base64,/,
      "",
    );
    const imageBuffer = Buffer.from(rawBase64, "base64");
    const imageFile = await toFile(imageBuffer, "image.png", {
      type: "image/png",
    });
    const res = await client.images.edit({
      model: modelId,
      image: imageFile,
      prompt,
      size,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned by OpenAI");
    // The Images API is billed per-image; no token usage is returned.
    console.log("[AI] OpenAI response", {
      provider: "openai",
      model: modelId,
      usage: "n/a (billed per image)",
    });
    return `data:image/png;base64,${b64}`;
  }

  const res = await client.images.generate({ model: modelId, prompt, size });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned by OpenAI");
  console.log("[AI] OpenAI response", {
    provider: "openai",
    model: modelId,
    usage: "n/a (billed per image)",
  });
  return `data:image/png;base64,${b64}`;
}
