-- ============================================================
-- Add user-selectable QUALITY (images) and RESOLUTION (video) with per-option
-- credit multipliers. Options are stored as a JSONB array of:
--   { "value": string, "label": string, "param"?: string, "multiplier": number }
--   - value:      the selectable key (also the OpenRouter resolution for video)
--   - label:      shown in the picker, e.g. "Standard (2K)" / "1080p · High"
--   - param:      provider-native value (OpenAI `quality` / Gemini `imageSize`);
--                 defaults to `value` when omitted
--   - multiplier: credit cost = tokens_per_generation * multiplier
-- An empty array means the model exposes no quality/resolution control.
-- Safe to run on an existing database.
-- ============================================================

-- Image models: quality tiers
alter table ai_models
  add column if not exists quality_options jsonb not null default '[]'::jsonb;
alter table ai_models
  add column if not exists default_quality text;

-- Video models: resolution tiers
alter table video_models
  add column if not exists resolution_options jsonb not null default '[]'::jsonb;
alter table video_models
  add column if not exists default_resolution text;

-- Store the quality actually used on each image generation (video already has `resolution`).
alter table generations
  add column if not exists quality text;
