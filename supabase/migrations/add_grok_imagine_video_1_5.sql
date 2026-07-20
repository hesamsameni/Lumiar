-- ============================================================
-- ADD: x-ai/grok-imagine-video-1.5 (OpenRouter, Jul 2026)
--
-- Source: GET https://openrouter.ai/api/v1/videos/models
--   resolutions: 480p / 720p / 1080p
--   durations: 1–15s
--   frame_images: first_frame only (no last_frame)
--   pricing: $0.08/s (480p), $0.14/s (720p), $0.25/s (1080p)
--
-- Credits target ~2x provider cost (~$0.0083/credit):
--   credits/sec @ 720p ~= round(0.14 * 241) = 34 → 170 credits @ 5s.
-- Resolution multipliers are relative to the 720p default.
-- ============================================================

-- Keep the original Grok after the newer 1.5 in the picker.
update video_models
set sort_order = 17, updated_at = now()
where id = 'x-ai/grok-imagine-video' and sort_order <= 16;

insert into video_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, duration_seconds, supported_durations,
  resolution, resolution_options, default_resolution,
  supports_image_input, supports_last_frame, supported_aspect_ratios,
  recommended, is_active, sort_order
) values (
  'x-ai/grok-imagine-video-1.5',
  'Grok Imagine Video 1.5',
  'xAI image-to-video with stronger motion, physics, and synchronized audio.',
  'mid',
  'openrouter',
  170,
  '~$0.14/s',
  5,
  '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}',
  '720p',
  '[
    {"value":"480p","label":"480p · Fast","hint":"Best for cheap drafts & quick previews","multiplier":0.57},
    {"value":"720p","label":"720p · Standard","hint":"Best for social clips","multiplier":1},
    {"value":"1080p","label":"1080p · High","hint":"Best for crisp, detailed final videos","multiplier":1.8}
  ]'::jsonb,
  '720p',
  true,
  false,
  '{"16:9","9:16","1:1","4:3","3:4","3:2","2:3"}',
  false,
  true,
  16
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
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
