-- ============================================================
-- VIDEO GENERATIONS
-- Stores video-generation jobs (async via OpenRouter). A row is created when a
-- job is submitted (status 'pending') and finalized once the clip is downloaded
-- to R2 (status 'completed') or the job fails (status 'failed', credits refunded).
-- ============================================================
create table if not exists video_generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  prompt text not null,
  model_id text not null,
  model_name text not null,
  provider text not null default 'openrouter',
  -- OpenRouter async job id (for polling).
  job_id text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  output_video_url text,
  thumbnail_url text,
  input_image_url text,
  duration_seconds integer not null default 5,
  resolution text,
  aspect_ratio text not null default '16:9',
  tokens_used integer not null default 0,
  is_shared boolean not null default false,
  metadata jsonb default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table video_generations enable row level security;

-- Anyone can view shared videos; owners can view all of theirs.
drop policy if exists "Video generations are viewable" on video_generations;
create policy "Video generations are viewable"
  on video_generations for select
  using (is_shared = true or user_id = auth.uid());

drop policy if exists "Users can insert their own video generations" on video_generations;
create policy "Users can insert their own video generations"
  on video_generations for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own video generations" on video_generations;
create policy "Users can update their own video generations"
  on video_generations for update
  using (user_id = auth.uid());

drop policy if exists "Users can delete their own video generations" on video_generations;
create policy "Users can delete their own video generations"
  on video_generations for delete
  using (user_id = auth.uid());

create index if not exists video_generations_user_idx on video_generations(user_id);
create index if not exists video_generations_shared_idx on video_generations(is_shared);
create index if not exists video_generations_created_idx on video_generations(created_at desc);
create index if not exists video_generations_status_idx on video_generations(status);

-- Allow a dedicated ledger type for video spend (refunds use existing 'refund').
alter table token_transactions
  drop constraint if exists token_transactions_type_check;
alter table token_transactions
  add constraint token_transactions_type_check
  check (type in ('generation', 'video_generation', 'purchase', 'welcome', 'refund', 'referral'));
