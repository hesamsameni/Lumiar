-- ============================================================
-- ADD: Runway video models (source: GET /api/v1/videos/models, Aug 2026)
--
-- runway/gen-4.5  — text-to-video + image-to-video (first frame). 720p only,
--   16:9 / 9:16, durations 2–10s, $0.12/s. Fits the composer -> enabled.
--   Credits target ~2x provider cost (~$0.0083/credit ~= usd*241):
--   round(0.12 * 241 * 5s) ~= 145 credits @ 5s.
--
-- runway/aleph-2  — in-context video EDITING model ($0.28/s). It edits an
--   EXISTING source video via text + keyframes (supported_durations = null,
--   frame_images = null). The current composer only does text/image-to-video and
--   has no source-video input, so it can't run yet -> added DISABLED
--   (is_active = false) until a video-editing flow exists.
--
-- Idempotent upsert; is_active/recommended/sort_order preserved on re-run.
-- ============================================================
insert into video_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, duration_seconds, supported_durations,
  resolution, supports_image_input, supports_last_frame, supported_aspect_ratios,
  recommended, is_active, sort_order
) values
  (
    'runway/gen-4.5', 'Gen-4.5',
    'Runway text/image-to-video — cinematic scenes with strong motion, fidelity and prompt adherence.',
    'mid', 'openrouter', 145, '~$0.12/s', 5, '{2,3,4,5,6,7,8,9,10}',
    '720p', true, false, '{"16:9","9:16"}', false, true, 18
  ),
  (
    'runway/aleph-2', 'Aleph 2.0',
    'Runway in-context video editing — restyle, replace or relight existing footage via text + keyframes. Requires a source video.',
    'high', 'openrouter', 337, '~$0.28/s', 5, '{5}',
    '720p', false, false, '{"16:9","4:3","3:2","1:1","2:3","3:4","9:16","21:9"}',
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
  supports_last_frame = excluded.supports_last_frame,
  supported_aspect_ratios = excluded.supported_aspect_ratios,
  updated_at = now();
-- Note: is_active, recommended and sort_order are intentionally NOT overwritten,
-- so admin toggles survive re-runs.
