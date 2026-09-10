-- ============================================================
-- ADD: openai/gpt-image-2.5-sunburst & openai/gpt-image-2.5-flare
--      (OpenAI direct, Sep 2026)
--
-- Source: https://openrouter.ai/openai/gpt-image-2.5-sunburst
--         https://openrouter.ai/openai/gpt-image-2.5-flare
--
-- Both are the GPT Image 2.5 series from OpenAI (released Sep 9, 2026):
--   Sunburst — precision-oriented tier (higher quality / slower)
--   Flare    — speed-oriented tier (high-volume / rapid prototyping)
--
-- Pricing: same token rate as gpt-image-2 ($30/M image output tokens).
-- Credits mirror gpt-image-2: Standard (medium) = 10, High = 40 (×4).
--   round(~$0.041/image × 241) = 10 credits at medium quality.
--
-- Capabilities:
--   input_references: 0–16  → max_image_inputs = 16
--   quality: medium / high  → param matches OpenAI's native quality param
--   aspect_ratios: 1:1 3:2 2:3 4:3 3:4 16:9 9:16 21:9
--   provider: openai (served direct via OpenAI Images API)
--
-- Added DISABLED (is_active = false) — flip via admin when ready.
-- Idempotent: on conflict, descriptive fields + quality options are refreshed
-- but is_active/recommended/sort_order are preserved.
-- ============================================================

insert into ai_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, supports_image_input,
  max_image_inputs, max_resolution, quality_options, default_quality,
  recommended, is_active, sort_order
) values
  (
    'openai/gpt-image-2.5-sunburst',
    'GPT Image 2.5 Sunburst',
    'OpenAI''s precision-oriented GPT Image 2.5 tier — best for detailed creative work and accurate edits.',
    'mid', 'openai',
    10, '~$0.04/image', true, 16, '2048×2048',
    '[
      {"value":"standard","label":"Standard","hint":"Best for everyday images & fast iteration","param":"medium","multiplier":1},
      {"value":"high","label":"High","hint":"Best for photorealism & fine detail","param":"high","multiplier":4}
    ]'::jsonb,
    'standard',
    false, false, 33
  ),
  (
    'openai/gpt-image-2.5-flare',
    'GPT Image 2.5 Flare',
    'OpenAI''s speed-oriented GPT Image 2.5 tier — best for high-volume generation, creator content and rapid prototyping.',
    'mid', 'openai',
    10, '~$0.04/image', true, 16, '2048×2048',
    '[
      {"value":"standard","label":"Standard","hint":"Best for everyday images & fast iteration","param":"medium","multiplier":1},
      {"value":"high","label":"High","hint":"Best for photorealism & fine detail","param":"high","multiplier":4}
    ]'::jsonb,
    'standard',
    false, false, 34
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
