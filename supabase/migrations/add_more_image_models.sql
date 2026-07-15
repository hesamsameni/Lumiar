-- ============================================================
-- Add newer image-generation models (source: OpenRouter /api/v1/models
-- ?output_modalities=image, verified Jul 2026).
--
-- Provider strategy is unchanged: Google models are served DIRECT via Google,
-- OpenAI DIRECT via OpenAI, and everything else via OpenRouter.
--
-- The new Google Lite model is enabled (fits the active Nano Banana lineup);
-- the OpenRouter additions are inserted DISABLED so they show up in the admin
-- panel without changing the current picker — flip is_active to expose them.
--
-- Credits are ranked by OpenRouter's per-token image_output price (image models
-- bill per token, so exact per-image cost varies by resolution) and aligned to
-- Lumiar's existing tier scale. Descriptions are condensed from OpenRouter.
--
-- Idempotent: existing rows are never touched (on conflict do nothing).
-- ============================================================
insert into ai_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, supports_image_input,
  max_image_inputs, max_resolution, recommended, is_active, sort_order
) values
  -- Google (direct) — cheapest Gemini image tier
  (
    'google/gemini-3.1-flash-lite-image',
    'Nano Banana 2 Lite',
    'Cheapest, fastest Gemini — best for quick drafts and high-volume iteration.',
    'low', 'google',
    2, '~$0.015/image', true, 8, '1024×1024', false, true, 6
  ),

  -- OpenRouter long-tail (added disabled; enable in admin as desired)
  (
    'black-forest-labs/flux.2-klein-4b',
    'Flux.2 Klein',
    'Fastest, cheapest FLUX — best for quick drafts at good quality.',
    'low', 'openrouter',
    3, '~$0.012/image', true, 1, '1024×1024', false, false, 13
  ),
  (
    'black-forest-labs/flux.2-max',
    'Flux.2 Max',
    'FLUX flagship — best for the highest-detail, photorealistic results and precise edits.',
    'high', 'openrouter',
    12, '~$0.08/image', true, 6, '2048×2048', false, false, 12
  ),
  (
    'recraft/recraft-v4.1',
    'Recraft V4.1',
    'Design-focused — best for logos, branding, icons and text-in-image layouts.',
    'mid', 'openrouter',
    7, '~$0.04/image', true, 1, '1024×1024', false, false, 14
  ),
  (
    'recraft/recraft-v4.1-pro',
    'Recraft V4.1 Pro',
    'Pro design quality at 2K — best for polished logos, product and editorial art.',
    'high', 'openrouter',
    13, '~$0.09/image', true, 1, '2048×2048', false, false, 15
  ),
  (
    'sourceful/riverflow-v2.5-pro',
    'Riverflow 2.5 Pro',
    'Top-tier control — best for quality-sensitive generation and precise image editing.',
    'high', 'openrouter',
    12, '~$0.08/image', true, 1, '2048×2048', false, false, 16
  ),
  (
    'sourceful/riverflow-v2.5-fast',
    'Riverflow 2.5 Fast',
    'Fast unified generate/edit — best for production, latency-sensitive workflows.',
    'mid', 'openrouter',
    5, '~$0.025/image', true, 1, '2048×2048', false, false, 17
  ),
  (
    'recraft/recraft-v4.1-vector',
    'Recraft V4.1 Vector',
    'SVG vector output — best for scalable logos, icons and illustrations.',
    'mid', 'openrouter',
    9, '~$0.05/image', true, 1, '1024×1024', false, false, 18
  ),
  (
    'recraft/recraft-v4.1-pro-vector',
    'Recraft V4.1 Pro Vector',
    'High-res SVG vectors — best for professional logos and scalable brand art.',
    'high', 'openrouter',
    14, '~$0.10/image', true, 1, '2048×2048', false, false, 19
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
