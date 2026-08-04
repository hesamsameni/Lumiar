-- ============================================================
-- Add Microsoft MAI-Image-2.5 Pro (source: OpenRouter dedicated Image API —
-- /api/v1/images/models, verified Jul 2026; released Jul 23 2026).
--
-- Served via OpenRouter (provider = 'openrouter'), matching the existing
-- strategy (Google direct, OpenAI direct, everything else OpenRouter).
--
-- Capabilities: text+image -> image, accepts up to 1 reference image
-- (input_references max 1 -> max_image_inputs = 1). Exposes no resolution
-- tiers, so quality_options is left null. High-quality "Pro" model -> high tier.
--
-- Pricing (OpenRouter Image API endpoints, per output-image token):
--   MAI-Image-2.5      -> $4.7e-5/token
--   MAI-Image-2.5 Pro  -> $1.08e-4/token   (~2.3x the base model)
-- Credits are ranked by that per-token output price, calibrated to existing
-- per-token models (gemini-3.1-flash-image 6e-5 -> 16, gpt-image-2 3e-5 -> 10),
-- which puts Pro at ~30. This keeps Pro correctly ABOVE the base MAI-Image-2.5.
--
-- Added DISABLED (is_active = false) so it appears in the admin panel without
-- changing the live picker — flip is_active to expose it.
--
-- Idempotent: on conflict, descriptive fields are refreshed but is_active,
-- recommended and sort_order are preserved so admin toggles survive re-runs.
-- ============================================================
insert into ai_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, supports_image_input,
  max_image_inputs, max_resolution, recommended, is_active, sort_order
) values
  (
    'microsoft/mai-image-2.5-pro',
    'MAI-Image-2.5 Pro',
    'Microsoft''s high-quality MAI model — photorealistic and artistic results with strong aspect-ratio control.',
    'high', 'openrouter',
    30, '~$0.18/image', true, 1, null, false, false, 23
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
  updated_at = now();
-- Note: is_active, recommended and sort_order are intentionally NOT overwritten,
-- so any admin toggles you've made are preserved on re-run.
