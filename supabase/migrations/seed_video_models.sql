-- ============================================================
-- SEED: video_models  (source: OpenRouter /api/v1/videos/models, Jul 2026)
--
-- `id` is prefixed by the model MAKER (google/openai/bytedance/…) so the UI can
-- group by brand. `provider` is the internal serving route (all served via
-- OpenRouter here) and is never shown to users.
--
-- PRICING: providers bill per video-second. `tokens_per_generation` is the
-- credit cost at the model's default `duration_seconds`; the app scales it
-- linearly for other durations. Credits target ~2x provider cost — worst-case
-- revenue ~= $0.0083/credit (largest bonus pack), R2 egress free, ~3% Stripe.
-- Effective rate ~= round(usd_per_second * 241) credits/second.
--
-- This wipes and rebuilds the catalog. Remove the DELETE if you keep custom
-- admin-added models.
-- ============================================================
delete from video_models;

insert into video_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, duration_seconds, supported_durations,
  resolution, supports_image_input, supported_aspect_ratios,
  recommended, is_active, sort_order
) values
  (
    'google/veo-3.1', 'Veo 3.1',
    'Highest-fidelity Google video with cinematic motion and synchronized audio.',
    'high', 'openrouter', 600, '~$0.40/s', 6, '{4,6,8}',
    '1080p', true, '{"16:9","9:16"}', false, true, 1
  ),
  (
    'google/veo-3.1-fast', 'Veo 3.1 Fast',
    'Fast, affordable clips with audio. Great for quick iterations and social content.',
    'mid', 'openrouter', 180, '~$0.12/s', 6, '{4,6,8}',
    '1080p', true, '{"16:9","9:16"}', true, true, 2
  ),
  (
    'google/veo-3.1-lite', 'Veo 3.1 Lite',
    'The most economical Veo tier for drafts and rapid experimentation.',
    'low', 'openrouter', 120, '~$0.08/s', 6, '{4,6,8}',
    '720p', true, '{"16:9","9:16"}', false, true, 3
  ),
  (
    'openai/sora-2-pro', 'Sora 2 Pro',
    'Premium cinematic generation with strong prompt adherence and long clips.',
    'high', 'openrouter', 1000, '~$0.50/s', 8, '{4,8,12,16,20}',
    '1080p', true, '{"16:9","9:16"}', false, true, 4
  ),
  (
    'bytedance/seedance-2.0', 'Seedance 2.0',
    'ByteDance flagship with expressive motion up to 1080p and long durations.',
    'high', 'openrouter', 250, '~$0.20/s', 5,
    '{4,5,6,7,8,9,10,11,12,13,14,15}',
    '1080p', true, '{"16:9","9:16","1:1","4:3","3:4","21:9","9:21"}',
    false, true, 5
  ),
  (
    'bytedance/seedance-2.0-fast', 'Seedance 2.0 Fast',
    'Faster, cheaper Seedance 2.0 variant for quick drafts.',
    'mid', 'openrouter', 200, '~$0.15/s', 5,
    '{4,5,6,7,8,9,10,11,12,13,14,15}',
    '720p', true, '{"16:9","9:16","1:1","4:3","3:4","21:9","9:21"}',
    false, true, 6
  ),
  (
    'bytedance/seedance-1-5-pro', 'Seedance 1.5 Pro',
    'Balanced quality and motion. Solid all-rounder for narrative shots.',
    'mid', 'openrouter', 150, '~$0.12/s', 5, '{4,5,6,7,8,9,10,11,12}',
    '1080p', true, '{"16:9","9:16","1:1","4:3","3:4","21:9","9:21"}',
    false, true, 7
  ),
  (
    'kwaivgi/kling-v3.0-pro', 'Kling v3.0 Pro',
    'Kuaishou Kling Pro with smooth, controllable motion and optional audio.',
    'mid', 'openrouter', 150, '~$0.11/s', 5,
    '{3,4,5,6,7,8,9,10,11,12,13,14,15}',
    '720p', true, '{"16:9","9:16","1:1"}', false, true, 8
  ),
  (
    'kwaivgi/kling-v3.0-std', 'Kling v3.0 Standard',
    'Standard Kling tier — a great value for everyday clips.',
    'low', 'openrouter', 110, '~$0.08/s', 5,
    '{3,4,5,6,7,8,9,10,11,12,13,14,15}',
    '720p', true, '{"16:9","9:16","1:1"}', false, true, 9
  ),
  (
    'kwaivgi/kling-video-o1', 'Kling Video O1',
    'Kling O1 for coherent 5s and 10s clips.',
    'mid', 'openrouter', 150, '~$0.11/s', 5, '{5,10}',
    '720p', true, '{"16:9","9:16","1:1"}', false, true, 10
  ),
  (
    'alibaba/wan-2.7', 'Wan 2.7',
    'Alibaba Wan 2.7 with flexible aspect ratios up to 1080p.',
    'low', 'openrouter', 125, '~$0.10/s', 5, '{2,3,4,5,6,7,8,9,10}',
    '1080p', true, '{"16:9","9:16","1:1","4:3","3:4"}', false, true, 11
  ),
  (
    'alibaba/wan-2.6', 'Wan 2.6',
    'Previous-gen Wan for reliable 5s and 10s generations.',
    'low', 'openrouter', 200, '~$0.15/s', 5, '{5,10}',
    '1080p', true, '{"16:9","9:16"}', false, true, 12
  ),
  (
    'alibaba/happyhorse-1.1', 'HappyHorse 1.1',
    'Alibaba HappyHorse 1.1 with wide aspect-ratio support up to 1080p.',
    'mid', 'openrouter', 125, '~$0.10/s', 5,
    '{3,4,5,6,7,8,9,10,11,12,13,14,15}',
    '720p', true, '{"16:9","9:16","1:1","4:3","3:4","21:9","9:21"}',
    false, true, 13
  ),
  (
    'alibaba/happyhorse-1.0', 'HappyHorse 1.0',
    'The original HappyHorse model for versatile video generation.',
    'mid', 'openrouter', 125, '~$0.10/s', 5,
    '{3,4,5,6,7,8,9,10,11,12,13,14,15}',
    '720p', true, '{"16:9","9:16","1:1","4:3","3:4","21:9","9:21"}',
    false, true, 14
  ),
  (
    'minimax/hailuo-2.3', 'Hailuo 2.3',
    'MiniMax Hailuo 2.3 — crisp 1080p clips with lively motion.',
    'low', 'openrouter', 132, '~$0.08/s', 6, '{6,10}',
    '1080p', true, '{"16:9"}', false, true, 15
  ),
  (
    'x-ai/grok-imagine-video-1.5', 'Grok Imagine Video 1.5',
    'xAI image-to-video with stronger motion, physics, and synchronized audio.',
    'mid', 'openrouter', 170, '~$0.14/s', 5,
    '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}',
    '720p', true, '{"16:9","9:16","1:1","4:3","3:4","3:2","2:3"}',
    false, true, 16
  ),
  (
    'x-ai/grok-imagine-video', 'Grok Imagine Video',
    'xAI Grok Imagine for quick, flexible short-form video.',
    'low', 'openrouter', 100, '~$0.07/s', 5,
    '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15}',
    '720p', true, '{"16:9","9:16","1:1","4:3","3:4","3:2","2:3"}',
    false, true, 17
  ),
  (
    'runway/gen-4.5', 'Gen-4.5',
    'Runway text/image-to-video — cinematic scenes with strong motion, fidelity and prompt adherence.',
    'mid', 'openrouter', 145, '~$0.12/s', 5, '{2,3,4,5,6,7,8,9,10}',
    '720p', true, '{"16:9","9:16"}', false, true, 18
  ),
  (
    'runway/aleph-2', 'Aleph 2.0',
    'Runway in-context video editing — restyle, replace or relight existing footage via text + keyframes. Requires a source video.',
    'high', 'openrouter', 337, '~$0.28/s', 5, '{5}',
    '720p', false, '{"16:9","4:3","3:2","1:1","2:3","3:4","9:16","21:9"}',
    false, false, 19
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  tier = excluded.tier,
  provider = excluded.provider,
  tokens_per_generation = excluded.tokens_per_generation,
  price_estimate = excluded.price_estimate,
  duration_seconds = excluded.duration_seconds,
  supported_durations = excluded.supported_durations,
  resolution = excluded.resolution,
  supports_image_input = excluded.supports_image_input,
  supported_aspect_ratios = excluded.supported_aspect_ratios,
  recommended = excluded.recommended,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Models that support a first+last frame (frame interpolation).
update video_models set supports_last_frame = true
where id in (
  'google/veo-3.1',
  'google/veo-3.1-fast',
  'google/veo-3.1-lite',
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-1-5-pro',
  'kwaivgi/kling-v3.0-pro',
  'kwaivgi/kling-v3.0-std',
  'kwaivgi/kling-video-o1',
  'alibaba/wan-2.7',
  'alibaba/wan-2.6',
  'minimax/hailuo-2.3'
);
