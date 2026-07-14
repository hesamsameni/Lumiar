-- ============================================================
-- Add selectable clip durations to video_models.
-- Safe to run on an existing video_models table.
-- ============================================================
alter table video_models
  add column if not exists supported_durations integer[] not null default '{5}';

-- Serve every video model through OpenRouter only (incl. Google's Veo).
update video_models set provider = 'openrouter' where provider <> 'openrouter';

alter table video_models
  drop constraint if exists video_models_provider_check;
alter table video_models
  add constraint video_models_provider_check check (provider in ('openrouter'));
alter table video_models
  alter column provider set default 'openrouter';
