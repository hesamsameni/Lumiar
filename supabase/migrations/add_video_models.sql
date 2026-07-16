-- ============================================================
-- VIDEO MODELS
-- Catalog of video-generation models (parallel to ai_models).
-- Video is served via OpenRouter's video API and Google (Veo).
-- ============================================================
create table if not exists video_models (
  id text primary key,
  name text not null,
  description text not null default '',
  tier text not null check (tier in ('low', 'mid', 'high')),
  -- All video models are served through OpenRouter (incl. Google's Veo).
  provider text not null default 'openrouter' check (provider in ('openrouter')),
  -- Flat credit cost per generation. Clip length is fixed per model
  -- (see duration_seconds) so pricing stays a simple flat number.
  tokens_per_generation integer not null default 250,
  price_estimate text not null default '',
  -- Default output clip length in seconds.
  duration_seconds integer not null default 5,
  -- Clip lengths the user can choose from. Credits scale linearly with the
  -- selected duration (providers bill per video-second).
  supported_durations integer[] not null default '{5}',
  -- Default output resolution label, e.g. '720p' | '1080p'.
  resolution text not null default '720p',
  -- Selectable resolution tiers: [{ value, label, multiplier }]. Empty = no control.
  resolution_options jsonb not null default '[]',
  default_resolution text,
  -- Whether the model accepts a reference / first-frame image (image-to-video).
  supports_image_input boolean not null default true,
  -- Whether the model accepts a last-frame image (frame interpolation).
  supports_last_frame boolean not null default false,
  -- Supported aspect ratios, e.g. {'16:9','9:16','1:1'}.
  supported_aspect_ratios text[] not null default '{"16:9","9:16","1:1"}',
  recommended boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table video_models enable row level security;

drop policy if exists "Video models are viewable by everyone" on video_models;
create policy "Video models are viewable by everyone"
  on video_models for select using (true);

drop policy if exists "Only admins can insert video_models" on video_models;
create policy "Only admins can insert video_models"
  on video_models for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Only admins can update video_models" on video_models;
create policy "Only admins can update video_models"
  on video_models for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Only admins can delete video_models" on video_models;
create policy "Only admins can delete video_models"
  on video_models for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create index if not exists video_models_is_active_idx on video_models(is_active);
create index if not exists video_models_sort_order_idx on video_models(sort_order);
