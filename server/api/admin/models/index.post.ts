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
    supports_image_input,
    max_image_inputs,
    max_resolution,
    recommended,
    is_active,
    sort_order,
  } = body;

  if (!id || !name || !tier || !provider) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields: id, name, tier, provider",
    });
  }

  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from("ai_models")
    .insert({
      id,
      name,
      description: description ?? "",
      tier,
      provider,
      tokens_per_generation: tokens_per_generation ?? 5,
      price_estimate: price_estimate ?? "",
      supports_image_input: supports_image_input ?? true,
      max_image_inputs: max_image_inputs ?? 1,
      max_resolution: max_resolution ?? null,
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
