import type { AIModel } from "~/utils/models";
import { compressImage } from "~/utils/imageCompression";

function friendlyErrorMessage(err: unknown): {
  title: string;
  description: string;
} {
  // $fetch wraps H3 errors as FetchError; real message lives in err.data.message
  const raw: string =
    ((err as any)?.data?.message ??
      (err as any)?.data?.statusMessage ??
      (err instanceof Error ? err.message : "")) ||
    "Generation failed";

  const lower = raw.toLowerCase();

  if (
    lower.includes("content policy") ||
    lower.includes("safety") ||
    lower.includes("inappropriate") ||
    lower.includes("violat")
  )
    return {
      title: "Prompt blocked",
      description:
        "Your prompt was flagged by the AI's content policy. Try rephrasing it.",
    };
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("429")
  )
    return {
      title: "Service busy",
      description:
        "The AI service is at capacity right now. Please wait a moment and try again.",
    };
  if (
    lower.includes("prompt is too long") ||
    lower.includes("context length") ||
    lower.includes("max_tokens") ||
    lower.includes("token limit")
  )
    return {
      title: "Prompt too long",
      description: "Your prompt exceeds the model's limit. Try shortening it.",
    };
  if (
    lower.includes("not authenticated") ||
    lower.includes("unauthorized") ||
    lower.includes("session")
  )
    return {
      title: "Session expired",
      description: "Please sign in again and retry.",
    };
  if (
    lower.includes("does not support image") ||
    lower.includes("no image input")
  )
    return {
      title: "Model limitation",
      description:
        "This model doesn't support image inputs. Remove the image or switch to a model that supports it.",
    };
  if (lower.includes("failed to upload"))
    return {
      title: "Upload failed",
      description:
        "The image was generated but couldn't be saved. Please try again.",
    };
  if (lower.includes("failed to save"))
    return {
      title: "Save failed",
      description:
        "The image was generated but couldn't be recorded. Please try again.",
    };
  if (
    lower.includes("image is too large") ||
    lower.includes("payload too large") ||
    lower.includes("413")
  )
    return {
      title: "Image too large",
      description:
        "The input image exceeds the size limit. Try using a smaller image.",
    };
  if (lower.includes("not authenticated") || lower.includes("sign in"))
    return {
      title: "Sign in required",
      description: "Please sign in to generate images.",
    };
  if (lower.includes("invalid") && lower.includes("prompt"))
    return { title: "Invalid prompt", description: raw };
  if (
    lower.includes("500") ||
    lower.includes("internal server") ||
    lower.includes("image generation failed")
  )
    return {
      title: "Generation failed",
      description:
        "The AI service encountered an error. Try again or switch to a different model.",
    };

  return { title: "Generation failed", description: raw };
}

export function useGeneration() {
  const { profile } = useProfile();
  const supabase = useSupabaseClient();
  const toast = useToast();
  const { fetchBalance } = useTokens();
  const posthog = usePostHog();

  const isGenerating = ref(false);
  const isPendingInBackground = ref(false);
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
    isPendingInBackground.value = false;
    result.value = null;
    const requestStartedAt = new Date();

    posthog?.capture("image_generation_started", {
      model_name: opts.model.name,
      model_id: opts.model.id,
      provider: opts.model.provider,
      tokens_required: opts.model.tokens_per_generation,
      has_input_images:
        (opts.inputImageFiles?.length ?? 0) > 0 || !!opts.inputImageUrl,
      aspect_ratio: opts.aspectRatio ?? "1:1",
      is_edit: !!opts.parentId,
    });

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

      await fetchBalance();

      result.value = {
        imageUrl: genRes.imageUrl,
        generationId: genRes.generationId,
      };
      posthog?.capture("image_generation_completed", {
        model_name: opts.model.name,
        model_id: opts.model.id,
        provider: opts.model.provider,
        tokens_used: opts.model.tokens_per_generation,
        has_input_images:
          (opts.inputImageFiles?.length ?? 0) > 0 || !!opts.inputImageUrl,
        aspect_ratio: opts.aspectRatio ?? "1:1",
        is_edit: !!opts.parentId,
        generation_id: genRes.generationId,
      });
      toast.add({ title: "Image generated!", color: "success" });
      return result.value;
    } catch (err: unknown) {
      const statusCode =
        (err as any)?.status ??
        (err as any)?.statusCode ??
        (err as any)?.data?.status;
      const isGatewayTimeout =
        statusCode === 524 ||
        statusCode === 504 ||
        (err as any)?.data?.cloudflare_error === true;

      if (isGatewayTimeout) {
        isPendingInBackground.value = true;
        isGenerating.value = false;
        toast.add({
          title: "Still generating…",
          description:
            "This model is taking a while. Your image will appear here and in your profile when ready — you can browse other pages.",
          color: "info",
          duration: 8000,
        });
        pollForGeneration(requestStartedAt);
        return null;
      }

      const { title, description } = friendlyErrorMessage(err);
      posthog?.capture("image_generation_failed", {
        model_name: opts.model.name,
        model_id: opts.model.id,
        provider: opts.model.provider,
        error_title: title,
      });
      toast.add({ title, description, color: "error" });
      return null;
    } finally {
      isGenerating.value = false;
    }
  }

  async function pollForGeneration(since: Date) {
    const MAX_ATTEMPTS = 24; // 24 × 15 s = 6 min
    let attempts = 0;

    const check = async () => {
      if (!isPendingInBackground.value || attempts >= MAX_ATTEMPTS) {
        isPendingInBackground.value = false;
        return;
      }
      attempts++;

      try {
        const { data } = await (supabase as any)
          .from("generations")
          .select("id, output_image_url")
          .eq("user_id", profile.value?.id)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          isPendingInBackground.value = false;
          result.value = {
            imageUrl: data[0].output_image_url,
            generationId: data[0].id,
          };
          await fetchBalance();
          toast.add({ title: "Image ready!", color: "success" });
          return;
        }
      } catch {
        // silently retry
      }

      setTimeout(check, 15_000);
    };

    setTimeout(check, 20_000); // first check after 20 s
  }

  return { generate, isGenerating, isPendingInBackground, result };
}
