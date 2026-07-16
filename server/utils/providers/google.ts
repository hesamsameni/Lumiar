import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Aspect ratios supported by Imagen models.
 */
const IMAGEN_SUPPORTED_RATIOS = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"]);

/**
 * Returns true when the model ID refers to an Imagen model.
 * Imagen models only support text-to-image (no image input).
 */
function isImagenModel(modelId: string): boolean {
  return modelId.toLowerCase().startsWith("imagen");
}

const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com";

export async function generateWithGoogle(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  inputImagesBase64: string[],
  // Optional Gemini image resolution ("1K" | "2K" | "4K"); omitted -> model default.
  imageSize?: string | null,
): Promise<string> {
  const client = new GoogleGenAI({ apiKey });

  console.log("[AI] Google request", {
    provider: "google",
    model: modelId,
    baseUrl: GOOGLE_BASE_URL,
    type: isImagenModel(modelId) ? "imagen" : "gemini",
    imageCount: inputImagesBase64.length,
  });

  if (isImagenModel(modelId)) {
    const ratio = IMAGEN_SUPPORTED_RATIOS.has(aspectRatio)
      ? aspectRatio
      : "1:1";

    const response = await client.models.generateImages({
      model: modelId,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: ratio,
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes ?? null;
    if (!imageBytes) throw new Error("No image returned by Google Imagen");

    // Imagen API does not return token usage.
    console.log("[AI] Google Imagen response", {
      provider: "google",
      model: modelId,
      usage: "n/a (Imagen API)",
    });

    const base64 =
      typeof imageBytes === "string"
        ? imageBytes
        : Buffer.from(imageBytes).toString("base64");
    return `data:image/png;base64,${base64}`;
  }

  // Gemini models with image output — supports multiple reference images
  const parts: Array<Record<string, unknown>> = [];

  for (const b64 of inputImagesBase64) {
    const match = b64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
  }

  parts.push({ text: prompt });

  // Gemini image resolution + shape are set via imageConfig (imageSize: 1K/2K/4K).
  const imageConfig: { imageSize?: string; aspectRatio?: string } = {};
  if (imageSize) imageConfig.imageSize = imageSize;
  if (aspectRatio && aspectRatio !== "auto") imageConfig.aspectRatio = aspectRatio;

  const response = await client.models.generateContent({
    model: modelId,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
    },
  });

  const usage = response.usageMetadata;
  if (usage) {
    console.log("[AI] Google Gemini response", {
      provider: "google",
      model: modelId,
      usage: {
        prompt_tokens: usage.promptTokenCount,
        candidates_tokens: usage.candidatesTokenCount,
        total_tokens: usage.totalTokenCount,
      },
    });
  }

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType ?? "image/png";
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image returned by Google");
}
