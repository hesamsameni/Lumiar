-- ============================================================
-- Add video input, audio input, and audio generation support to video models.
--
-- New capability columns on video_models:
--   supports_video_input   – model accepts a reference/source video
--   supports_audio_input   – model accepts an audio track (lip-sync, sound-driven)
--   supports_audio_generation – model can generate synchronized audio
--
-- New column on video_generations:
--   input_video_url – stores the temp R2 URL of the uploaded source video
--   input_audio_url – stores the temp R2 URL of the uploaded source audio
--
-- Safe to run on an existing database (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================

-- ── video_models capability columns ──────────────────────────────────────────
alter table video_models
  add column if not exists supports_video_input boolean not null default false;

alter table video_models
  add column if not exists supports_audio_input boolean not null default false;

alter table video_models
  add column if not exists supports_audio_generation boolean not null default false;

-- Enable video input for models that accept it via OpenRouter input_references.
-- Only BytePlus Seedance 2.0+ providers honour video/audio references;
-- other providers (Alibaba, Google, etc.) silently ignore or reject them.
update video_models set supports_video_input = true
where id in (
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.0-mini',
  'bytedance/seedance-2.5',
  'black-forest-labs/flux-3-video'
);

-- Enable audio input for models that accept audio input_references via OpenRouter.
-- Only BytePlus Seedance 2.0+ providers honour audio references.
update video_models set supports_audio_input = true
where id in (
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.0-mini',
  'bytedance/seedance-2.5'
);

-- Enable audio generation for models with generate_audio: true in OpenRouter API.
update video_models set supports_audio_generation = true
where id in (
  'google/veo-3.1',
  'google/veo-3.1-fast',
  'google/veo-3.1-lite',
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.0-mini',
  'bytedance/seedance-2.5',
  'bytedance/seedance-1-5-pro',
  'black-forest-labs/flux-3-video',
  'minimax/hailuo-3',
  'kwaivgi/kling-v3.0-pro',
  'kwaivgi/kling-v3.0-std',
  'kwaivgi/kling-video-o1',
  'alibaba/wan-2.6',
  'alibaba/wan-2.7',
  'openai/sora-2-pro'
);

-- ── video_generations input columns ──────────────────────────────────────────
alter table video_generations
  add column if not exists input_video_url text;

alter table video_generations
  add column if not exists input_audio_url text;
