-- ============================================================
-- ADD: google/gemini-nano-banana-2.1 (Google, direct — Oct 2026)
--
-- Source: OpenRouter model page (google/gemini-nano-banana-2.1) + Gemini API
-- docs (ai.google.dev/gemini-api/docs/image-generation). Served direct via
-- Google (provider = 'google'), not OpenRouter — the "google/" prefix is
-- stripped server-side before hitting the Gemini API, and the real Gemini
-- model id is literally `gemini-nano-banana-2.1`, matching the existing
-- Nano Banana 2 / Nano Banana 2 Lite / Nano Banana Pro rows.
--
-- Pricing: Google AI Studio output-image tokens at $0.00003/token.
-- Output tokens by resolution tier (1:1, per Gemini docs): 1K=1120, 2K=1680,
-- 4K=2520 — the same 1 / 1.5 / 2.25 scaling already used for
-- google/gemini-3.1-flash-image's quality_options.
--   1K: 1120 × $0.00003 = $0.0336/image -> round(0.0336 × 241) = 8 credits
--   2K: 1680 × $0.00003 = $0.0504/image -> round(0.0504 × 241) = 12 credits
--   4K: 2520 × $0.00003 = $0.0756/image -> round(0.0756 × 241) = 18 credits
-- Base tokens_per_generation is the 1K (default/standard) tier; 2K/4K scale
-- via quality_options multipliers.
--
-- Capabilities: text+image -> image, up to 14 reference images
-- (input_references max 14), resolutions 1K/2K/4K, successor to Nano Banana 2.
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
  'google/gemini-nano-banana-2.1',
  'Nano Banana 2.1',
  'Google''s newest Flash-tier Nano Banana — best for sharper text, multi-turn edits and Search-grounded images, up to 4K.',
  'low',
  'google',
  8,
  '~$0.034/image',
  true,
  14,
  '4096×4096',
  '[
    {"value":"standard","label":"Standard (1K)","hint":"Best for quick drafts & high-volume iteration","param":"1K","multiplier":1},
    {"value":"high","label":"High (2K)","hint":"Best for crisp posts & detailed thumbnails","param":"2K","multiplier":1.5},
    {"value":"ultra","label":"Ultra (4K)","hint":"Best for print & large-format output","param":"4K","multiplier":2.25}
  ]'::jsonb,
  'standard',
  false,
  false,
  35
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
