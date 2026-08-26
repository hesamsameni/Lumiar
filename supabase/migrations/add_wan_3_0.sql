-- ============================================================
-- ADD: alibaba/wan-3.0 (OpenRouter, Aug 2026)
--
-- Source: GET https://openrouter.ai/api/v1/videos/models
--   resolutions: 480p / 720p / 1080p
--   durations: 2–30s
--   frame_images: first_frame only (no last_frame)
--   audio: generate_audio = true
--   pricing: $0.05/s (480p), $0.10/s (720p), $0.20/s (1080p)
--
-- Credits target ~2x provider cost (~$0.0083/credit):
--   credits/sec @ 720p ~= round(0.10 * 241) = 24 → 120 credits @ 5s.
-- Resolution multipliers are relative to the 720p default.
-- ============================================================

insert into video_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, duration_seconds, supported_durations,
  resolution, resolution_options, default_resolution,
  supports_image_input, supports_last_frame,
  supports_video_input, supports_audio_input, supports_audio_generation,
  max_references, max_reference_videos,
  supported_aspect_ratios,
  recommended, is_active, sort_order
) values (
  'alibaba/wan-3.0',
  'Wan 3.0',
  'Alibaba latest — text-to-video, image-to-video, and reference-guided generation up to 1080p and 30s with audio.',
  'mid',
  'openrouter',
  120,
  '~$0.10/s',
  5,
  '{2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30}',
  '720p',
  '[
    {"value":"480p","label":"480p · Fast","hint":"Best for cheap drafts & quick previews","multiplier":0.5},
    {"value":"720p","label":"720p · Standard","hint":"Best for social clips","multiplier":1},
    {"value":"1080p","label":"1080p · High","hint":"Best for crisp, detailed final videos","multiplier":2}
  ]'::jsonb,
  '720p',
  true,
  false,
  false,
  false,
  true,
  5,
  0,
  '{"16:9","4:3","1:1","3:4","9:16"}',
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
  supports_video_input = excluded.supports_video_input,
  supports_audio_input = excluded.supports_audio_input,
  supports_audio_generation = excluded.supports_audio_generation,
  max_references = excluded.max_references,
  max_reference_videos = excluded.max_reference_videos,
  supported_aspect_ratios = excluded.supported_aspect_ratios,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
