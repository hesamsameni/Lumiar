import type { AIModel } from "~/utils/models";
import { compressImage } from "~/utils/imageCompression";

export function useGeneration() {
  const { profile } = useProfile();
  const supabase = useSupabaseClient();
  const toast = useToast();
  const { deductTokens, fetchBalance } = useTokens();

  const isGenerating = ref(false);
  const result = ref<{ imageUrl: string; generationId: string } | null>(null);

  async function generate(opts: {
    prompt: string;
    model: AIModel;
    inputImageFiles?: File[] | null;
    inputImageUrl?: string | null;
    aspectRatio?: string;
    parentId?: string | null;
  }) {
    if (!profile.value?.id) {
      toast.add({
        title: "Sign in required",
        description: "Please sign in to generate images.",
        color: "error",
      });
      return null;
    }

    const balance = profile.value.token_balance ?? 0;
    if (!profile.value.is_admin && balance < opts.model.tokens_per_generation) {
      toast.add({
        title: "Insufficient tokens",
        description: `This model requires ${opts.model.tokens_per_generation} tokens but you only have ${balance}. Purchase more tokens to continue.`,
        color: "warning",
      });
      return null;
    }

    isGenerating.value = true;
    result.value = null;

    try {
      let inputImageUrl: string | null = opts.inputImageUrl ?? null;
      // Arrays for multi-image support
      const inputImagesBase64: string[] = [];
      const inputImageUrls: string[] = [];

      // Get a fresh token for every API call — do not rely on reactive ref
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const authHeaders = { Authorization: `Bearer ${accessToken}` };

      const files = opts.inputImageFiles?.filter(Boolean) ?? [];
      for (const file of files) {
        // Compress (and auto-convert HEIC/HEIF) client-side to avoid FUNCTION_PAYLOAD_TOO_LARGE
        const compressed = await compressImage(file);

        // Convert to base64 data URI for the AI provider
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressed);
        });
        inputImagesBase64.push(base64);

        // Also upload compressed file to CDN for the DB record
        const fd = new FormData();
        fd.append("file", compressed);
        const uploadRes = await $fetch<{ url: string }>("/api/upload", {
          method: "POST",
          body: fd,
          headers: authHeaders,
        });
        inputImageUrls.push(uploadRes.url);
      }

      // For legacy single-file callers, keep inputImageUrl from opts as-is.

      const genRes = await $fetch<{
        imageUrl: string;
        generationId: string;
      }>("/api/generate", {
        method: "POST",
        body: {
          prompt: opts.prompt,
          modelId: opts.model.id,
          modelName: opts.model.name,
          provider: opts.model.provider,
          inputImagesBase64:
            inputImagesBase64.length > 0 ? inputImagesBase64 : undefined,
          inputImageUrls:
            inputImageUrls.length > 0 ? inputImageUrls : undefined,
          inputImageUrl: inputImageUrl,
          tokensUsed: opts.model.tokens_per_generation,
          aspectRatio: opts.aspectRatio ?? "1:1",
          parentId: opts.parentId ?? null,
        },
        headers: authHeaders,
      });

      await deductTokens(
        opts.model.tokens_per_generation,
        genRes.generationId,
        `Generation with ${opts.model.name}`,
      );
      await fetchBalance();

      result.value = {
        imageUrl: genRes.imageUrl,
        generationId: genRes.generationId,
      };
      toast.add({ title: "Image generated!", color: "success" });
      return result.value;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.add({
        title: "Generation failed",
        description: msg,
        color: "error",
      });
      return null;
    } finally {
      isGenerating.value = false;
    }
  }

  return { generate, isGenerating, result };
}
