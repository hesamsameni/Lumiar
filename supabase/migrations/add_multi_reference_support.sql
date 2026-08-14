-- ============================================================
-- Add multi-reference support to video models.
--
-- New columns on video_models:
--   max_references        – max combined reference images + videos the model accepts
--                           (0 = no reference support, 1 = single, >1 = multi)
--   max_reference_videos  – of those, how many may be videos (0 = images only)
--
-- The existing `supports_video_input` boolean is reused to indicate whether
-- reference slots may accept video files in addition to images.
-- ============================================================

alter table video_models
  add column if not exists max_references int not null default 1;
alter table video_models
  add column if not exists max_reference_videos int not null default 0;

-- Models that don't accept any image input have 0 references.
update video_models set max_references = 0, max_reference_videos = 0
where supports_image_input = false and (supports_video_input is null or supports_video_input = false);

-- ── Per-model limits (based on provider documentation) ──────────────────

-- Seedance 2.x family: up to 30 images + 10 videos
update video_models set max_references = 40, max_reference_videos = 10
where id in (
  'bytedance/seedance-2.5',
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.0-mini'
);

-- Seedance 1.5 Pro: multimodal references (images + videos)
update video_models set max_references = 5, max_reference_videos = 5
where id = 'bytedance/seedance-1-5-pro';

-- Alibaba Wan 2.7/2.6: up to 5 combined reference images + videos
update video_models set max_references = 5, max_reference_videos = 5
where id in ('alibaba/wan-2.7', 'alibaba/wan-2.6');

-- Alibaba HappyHorse: up to 9 reference images (no video refs)
update video_models set max_references = 9, max_reference_videos = 0
where id in ('alibaba/happyhorse-1.1', 'alibaba/happyhorse-1.0');

-- MiniMax Hailuo H3: up to 9 images + 3 videos (total 12)
update video_models set max_references = 12, max_reference_videos = 3
where id = 'minimax/hailuo-3';

-- Kling v3.0: up to 7 images + 1 video
update video_models set max_references = 8, max_reference_videos = 1
where id in ('kwaivgi/kling-v3.0-pro', 'kwaivgi/kling-v3.0-std');

-- Google Veo 3.1: up to 3 subject reference images (no video refs)
update video_models set max_references = 3, max_reference_videos = 0
where id in ('google/veo-3.1', 'google/veo-3.1-fast', 'google/veo-3.1-lite');
