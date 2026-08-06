-- ============================================================
-- Add the Qwen Image 3 family (source: OpenRouter dedicated Image API —
-- /api/v1/images/models, verified Aug 2026; released Aug 5 2026).
--
-- Served via OpenRouter (provider = 'openrouter'). Both are generation + editing
-- models, text+image -> image, accepting up to 4 reference images
-- (input_references max 4 -> max_image_inputs = 4), with 1K/2K output.
--
-- Pricing (per output image, from the endpoints API):
--   qwen-image-3-pro : $0.04 (1K) / $0.075 (2K)
--   qwen-image-3     : $0.03 (1K and 2K — same price)
-- Credits are calibrated to the existing per-image scale (flux.2-max $0.07 -> 12,
-- i.e. ~171 credits per $/image at the 1K "standard" tier). The 2K multiplier is
-- the ratio of 2K/1K price (1.9 for Pro; 1.0 for the base, since 2K is free there).
--
-- Added DISABLED (is_active = false) so they appear in the admin panel without
-- changing the live picker — flip is_active to expose them.
--
-- Idempotent: on conflict, descriptive fields (incl. quality tiers) are refreshed
-- but is_active/recommended/sort_order are preserved so admin toggles survive.
-- ============================================================
insert into ai_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, supports_image_input,
  max_image_inputs, max_resolution, quality_options, default_quality,
  recommended, is_active, sort_order
) values
  (
    'qwen/qwen-image-3-pro',
    'Qwen Image 3 Pro',
    'Qwen generation + editing — precise text and fine detail (to ~10px) with strong world knowledge.',
    'mid', 'openrouter',
    7, '~$0.04/image', true, 4, '2048×2048',
    '[
      {"value":"standard","label":"Standard (1K)","hint":"Best for web, social & fast iteration","param":"1K","multiplier":1},
      {"value":"high","label":"High (2K)","hint":"Best for crisp detail & larger displays","param":"2K","multiplier":1.9}
    ]'::jsonb,
    'standard',
    false, false, 24
  ),
  (
    'qwen/qwen-image-3',
    'Qwen Image 3',
    'Unified Qwen generation + editing — precise text/detail, with 1K & 2K at the same price.',
    'low', 'openrouter',
    5, '~$0.03/image', true, 4, '2048×2048',
    '[
      {"value":"standard","label":"Standard (1K)","hint":"Best for web, social & fast iteration","param":"1K","multiplier":1},
      {"value":"high","label":"High (2K)","hint":"Free 2K — best for crisp detail","param":"2K","multiplier":1}
    ]'::jsonb,
    'standard',
    false, false, 25
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
-- Note: is_active, recommended and sort_order are intentionally NOT overwritten,
-- so any admin toggles you've made are preserved on re-run.
