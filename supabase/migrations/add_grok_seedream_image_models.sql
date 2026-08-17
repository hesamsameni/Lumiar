-- ============================================================
-- Add three new image models (source: OpenRouter dedicated Image API —
-- /api/v1/images/models, verified Aug 2026).
--
-- All three are served via OpenRouter (provider = 'openrouter').
--
-- 1. xAI: Grok Imagine Image 2.0 (x-ai/grok-imagine-image-2.0)
--    Released Aug 11 2026. Text + image → image, generation + editing.
--    Quality modes: low / medium. Resolution: 1K / 2K.
--    input_references max 3 → max_image_inputs = 3.
--    Pricing (from OpenRouter, low quality):
--      1K: $0.04/image (stated minimum: "from $0.04")
--      2K: $0.08/image (2× — confirmed via playground example)
--    quality_options model: resolution tier (low quality default).
--    Medium quality is a separate API param not modeled here.
--
-- 2. ByteDance Seed: Seedream 5.0 Pro (bytedance-seed/seedream-5-0-pro)
--    Released Aug 13 2026. Text + image → image, generation + editing.
--    Resolution: 1K / 2K. input_references max 14 → max_image_inputs = 14.
--    Pricing: $0.045/image flat regardless of resolution
--    (provider table shows single price $0.045; playground 2048×1152 = $0.045).
--
-- 3. ByteDance Seed: Seedream 5.0 Lite (bytedance-seed/seedream-5-0-lite)
--    Released Aug 13 2026. Text + image → image, generation.
--    Resolution: 2K / 4K. input_references max 14 → max_image_inputs = 14.
--    Pricing: $0.035/image flat regardless of resolution
--    (provider table shows single price $0.035; playground 3642×2048 = $0.035).
--
-- Credits calibrated to the existing per-image scale (flux.2-max $0.07 → 12,
-- i.e. ~171 credits per $/image at the standard tier):
--   Grok 2.0          : $0.04 → 7 tokens (1K); 2K multiplier 2.0
--   Seedream 5.0 Pro  : $0.045 → 8 tokens; both resolutions multiplier 1.0
--   Seedream 5.0 Lite : $0.035 → 6 tokens; both resolutions multiplier 1.0
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
    'x-ai/grok-imagine-image-2.0',
    'Grok Imagine Image 2.0',
    'xAI generation + editing model — suited for creating images from text and editing from references, with low and medium quality modes.',
    'mid', 'openrouter',
    7, '~$0.04/image', true, 3, '2048×2048',
    '[
      {"value":"standard","label":"Standard (1K)","hint":"Best for web, social & fast iteration","param":"1K","multiplier":1},
      {"value":"high","label":"High (2K)","hint":"2× resolution, 2× cost","param":"2K","multiplier":2.0}
    ]'::jsonb,
    'standard',
    false, false, 26
  ),
  (
    'bytedance-seed/seedream-5-0-pro',
    'Seedream 5.0 Pro',
    'ByteDance Seed generation + editing model for commercial visual-production workflows requiring precise editing control, lifelike scenes, and natural rendering.',
    'mid', 'openrouter',
    8, '~$0.045/image', true, 14, '2048×2048',
    '[
      {"value":"standard","label":"Standard (1K)","hint":"Best for web, social & fast iteration","param":"1K","multiplier":1},
      {"value":"high","label":"High (2K)","hint":"Higher resolution, same price","param":"2K","multiplier":1}
    ]'::jsonb,
    'standard',
    false, false, 27
  ),
  (
    'bytedance-seed/seedream-5-0-lite',
    'Seedream 5.0 Lite',
    'ByteDance Seed image generation with web-connected retrieval, complex-prompt comprehension, and broad knowledge coverage; outputs at 2K–4K.',
    'low', 'openrouter',
    6, '~$0.035/image', true, 14, '4096×4096',
    '[
      {"value":"standard","label":"Standard (2K)","hint":"Best for web, social & fast iteration","param":"2K","multiplier":1},
      {"value":"ultra","label":"Ultra (4K)","hint":"Maximum resolution, same price","param":"4K","multiplier":1}
    ]'::jsonb,
    'standard',
    false, false, 28
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
