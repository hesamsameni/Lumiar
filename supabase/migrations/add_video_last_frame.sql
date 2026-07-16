-- ============================================================
-- Add last-frame support to video models.
-- Some models accept a first AND last frame (frame interpolation) via
-- OpenRouter's `frame_images` with frame_type "last_frame". `supports_image_input`
-- already covers first-frame + reference images; this flag gates the last frame.
-- Safe to run on an existing database.
-- ============================================================
alter table video_models
  add column if not exists supports_last_frame boolean not null default false;

-- Enable for models known to support first+last frame interpolation. Admins can
-- toggle this per model in the dashboard.
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
