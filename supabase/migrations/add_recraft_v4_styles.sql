-- ============================================================
-- ADD: Recraft V4 Styles family (OpenRouter, Aug 2026)
--
-- Source: GET https://openrouter.ai/api/v1/images/models
--
-- All four models are *style-consistent* generators: they require at least
-- one style-reference image and reproduce its rendering technique, colour,
-- texture and composition in a new output image.
--
--   recraft/recraft-v4-styles           — raster ~1K, $0.035/img  → 8 credits
--   recraft/recraft-v4-styles-pro       — raster ~2K, $0.10/img   → 24 credits
--   recraft/recraft-v4-styles-vector    — SVG,        $0.05/img   → 12 credits
--   recraft/recraft-v4-styles-pro-vector— SVG,        $0.12/img   → 29 credits
--
-- Credits target ~2x provider cost (~$0.0083/credit):
--   credits = round(usd_per_image × 241)
--
-- input_references: min 1, max 10 for all four models.
-- Aspect ratios: 1:1 2:1 1:2 3:2 2:3 4:3 3:4 5:4 4:5 16:9 9:16
--
-- Added DISABLED (is_active = false) — flip via admin when ready.
-- Idempotent: on conflict, descriptive fields are refreshed but
-- is_active/recommended/sort_order are preserved so admin toggles survive.
-- ============================================================

insert into ai_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, supports_image_input,
  max_image_inputs, max_resolution, recommended, is_active, sort_order
) values
  (
    'recraft/recraft-v4-styles',
    'Recraft V4 Styles',
    'Style-consistent generation — reproduces a reference image''s rendering technique, colour, texture and composition at ~1K.',
    'low', 'openrouter',
    8, '~$0.035/image', true, 10, '1024×1024', false, false, 29
  ),
  (
    'recraft/recraft-v4-styles-pro',
    'Recraft V4 Styles Pro',
    'Style-consistent generation at ~2K — reproduces a reference image''s rendering technique, colour, texture and composition.',
    'mid', 'openrouter',
    24, '~$0.10/image', true, 10, '2048×2048', false, false, 30
  ),
  (
    'recraft/recraft-v4-styles-vector',
    'Recraft V4 Styles Vector',
    'SVG style-consistent generation — reproduces a reference image''s style as scalable vector output.',
    'low', 'openrouter',
    12, '~$0.05/image', true, 10, 'SVG', false, false, 31
  ),
  (
    'recraft/recraft-v4-styles-pro-vector',
    'Recraft V4 Styles Pro Vector',
    'Premium SVG style-consistent generation — reproduces a reference image''s style as high-quality scalable vector output.',
    'mid', 'openrouter',
    29, '~$0.12/image', true, 10, 'SVG', false, false, 32
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
