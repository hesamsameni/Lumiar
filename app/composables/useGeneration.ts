import type { AIModel } from "~/utils/models";

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
    inputImageFile?: File | null;
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
      // Base64 data URL sent directly to /api/generate so the server never needs
      // to re-fetch the image from the CDN (avoids 403 hotlink protection issues).
      let inputImageBase64: string | null = null;

      // Get a fresh token for every API call — do not rely on reactive ref
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const authHeaders = { Authorization: `Bearer ${accessToken}` };

      if (opts.inputImageFile) {
        // Convert to base64 on the client — passed directly to the model
        inputImageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(opts.inputImageFile!);
        });
        // Also upload to CDN so we can store the URL in the DB record
        const fd = new FormData();
        fd.append("file", opts.inputImageFile);
        const uploadRes = await $fetch<{ url: string }>("/api/upload", {
          method: "POST",
          body: fd,
          headers: authHeaders,
        });
        inputImageUrl = uploadRes.url;
      }

      // Server handles: image generation, CDN upload, and DB insert.
      // This avoids client-side RLS issues by running all DB writes server-side.
      const genRes = await $fetch<{
        imageUrl: string;
        generationId: string;
      }>("/api/generate", {
        method: "POST",
        body: {
          prompt: opts.prompt,
          modelId: opts.model.id,
          modelName: opts.model.name,
          inputImageBase64: inputImageBase64 ?? null,
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
