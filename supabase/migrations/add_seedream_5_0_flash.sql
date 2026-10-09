-- ============================================================
-- ADD: bytedance-seed/seedream-5-0-flash (OpenRouter, Oct 2026)
--
-- Source: OpenRouter dedicated Image API — /api/v1/images/models +
-- /api/v1/images/models/bytedance-seed/seedream-5-0-flash/endpoints.
--
-- Fast, cost-efficient tier of the Seedream 5.0 family (siblings:
-- seedream-5-0-pro, seedream-5-0-lite already in ai_models). Text + image ->
-- image, generation + editing. Resolution: 1K / 2K. input_references max 14
-- -> max_image_inputs = 14.
--
-- Pricing: $0.018/image flat regardless of resolution (single output_image
-- price entry; no input_image charge).
-- Credits: round(0.018 × 241) = round(4.338) = 4 tokens; both resolutions
-- same price -> quality_options multiplier 1 for both tiers.
--
-- Added DISABLED (is_active = false) so it appears in the admin panel without
-- changing the live picker — flip is_active to expose it.
-- ============================================================
insert into ai_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, supports_image_input,
  max_image_inputs, max_resolution, quality_options, default_quality,
  recommended, is_active, sort_order
) values (
  'bytedance-seed/seedream-5-0-flash',
  'Seedream 5.0 Flash',
  'ByteDance Seed''s fast, cost-efficient Seedream 5.0 tier — best for high-volume production and interactive editing.',
  'low', 'openrouter',
  4, '~$0.018/image', true, 14, '2048×2048',
  '[
    {"value":"standard","label":"Standard (1K)","hint":"Best for web, social & fast iteration","param":"1K","multiplier":1},
    {"value":"high","label":"High (2K)","hint":"Higher resolution, same price","param":"2K","multiplier":1}
  ]'::jsonb,
  'standard',
  false, false, 36
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  tier = excluded.tier,
  provider = excluded.provider,
  tokens_per_generation = excluded.tokens_per_generation,
  price_estimate = excluded.price_estimate,
  supports_image_input = excluded.supports_image_input,
  max_image_inputs = excluded.max_image_inputs,
  max_resolution = excluded.max_resolution,
  quality_options = excluded.quality_options,
  default_quality = excluded.default_quality,
  updated_at = now();
