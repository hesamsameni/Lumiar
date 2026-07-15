import { serverSupabaseClient } from "#supabase/server";
import { requireAdmin } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);

  const {
    id,
    name,
    description,
    tier,
    provider,
    tokens_per_generation,
    price_estimate,
    duration_seconds,
    supported_durations,
    resolution,
    supports_image_input,
    supported_aspect_ratios,
    recommended,
    is_active,
    sort_order,
  } = body;

  if (!id || !name || !tier) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields: id, name, tier",
    });
  }

  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from("video_models")
    .insert({
      id,
      name,
      description: description ?? "",
      tier,
      // All video models are served via OpenRouter.
      provider: provider ?? "openrouter",
      tokens_per_generation: tokens_per_generation ?? 250,
      price_estimate: price_estimate ?? "",
      duration_seconds: duration_seconds ?? 5,
      supported_durations: supported_durations ?? [duration_seconds ?? 5],
      resolution: resolution ?? "720p",
      supports_image_input: supports_image_input ?? true,
      supported_aspect_ratios: supported_aspect_ratios ?? [
        "16:9",
        "9:16",
        "1:1",
      ],
      recommended: recommended ?? false,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
    } as never)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return data;
});
