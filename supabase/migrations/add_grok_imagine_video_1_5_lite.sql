-- ============================================================
-- ADD: x-ai/grok-imagine-video-1.5-lite (OpenRouter, Oct 2026)
--
-- Source: GET https://openrouter.ai/api/v1/videos/models
--   Distilled from x-ai/grok-imagine-video-1.5 — same resolutions/durations/
--   aspect ratios, trading quality for speed and lower cost.
--   resolutions: 480p / 720p / 1080p
--   durations: 1–15s
--   frame_images: first_frame only (no last_frame)
--   pricing: $0.02/s (480p), $0.03/s (720p), $0.14/s (1080p)
--
-- Credits target ~2x provider cost (~$0.0083/credit):
--   credits/sec @ 720p ~= round(0.03 * 241) = 7 → 36 credits @ 5s (round(0.03*5*241)).
-- Resolution multipliers are relative to the 720p default:
--   480p: 0.02/0.03 = 0.67, 1080p: 0.14/0.03 = 4.67 (1080p priced like the
--   flagship 1.5 model, so it's disproportionately pricier than 480p/720p here).
-- ============================================================
insert into video_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, duration_seconds, supported_durations,
  resolution, resolution_options, default_resolution,
  supports_image_input, supports_last_frame, supported_aspect_ratios,
  recommended, is_active, sort_order
) values (
  'x-ai/grok-imagine-video-1.5-lite',
  'Grok Imagine Video 1.5 Lite',
  'Faster, lower-cost xAI video model distilled from Grok Imagine Video 1.5 — best for quick drafts and high-volume iteration.',
  'low',
  'openrouter',
  36,
  '~$0.03/s',
  5,
  '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}',
  '720p',
  '[
    {"value":"480p","label":"480p · Fast","hint":"Best for cheap drafts & quick previews","multiplier":0.67},
    {"value":"720p","label":"720p · Standard","hint":"Best for social clips","multiplier":1},
    {"value":"1080p","label":"1080p · High","hint":"Best for crisp, detailed final videos","multiplier":4.67}
  ]'::jsonb,
  '720p',
  true,
  false,
  '{"16:9","9:16","1:1","4:3","3:4","3:2","2:3"}',
  false,
  false,
  24
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  tier = excluded.tier,
  tokens_per_generation = excluded.tokens_per_generation,
  price_estimate = excluded.price_estimate,
  duration_seconds = excluded.duration_seconds,
  supported_durations = excluded.supported_durations,
  resolution = excluded.resolution,
  resolution_options = excluded.resolution_options,
  default_resolution = excluded.default_resolution,
  supports_image_input = excluded.supports_image_input,
  supports_last_frame = excluded.supports_last_frame,
  supported_aspect_ratios = excluded.supported_aspect_ratios,
  updated_at = now();
