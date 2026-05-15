-- ============================================================
-- Visiona — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  token_balance integer not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert with check (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- ============================================================
-- GENERATIONS
-- ============================================================
create table if not exists generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  prompt text not null,
  model_id text not null,
  model_name text not null,
  input_image_url text,
  output_image_url text not null,
  tokens_used integer not null default 0,
  aspect_ratio text not null default '1:1',
  parent_id uuid references generations(id) on delete set null,
  is_shared boolean not null default false,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generations_user_id_fkey'
  ) then
    alter table generations
      add constraint generations_user_id_fkey
      foreign key (user_id) references profiles(id) on delete cascade;
  end if;
end $$;

alter table generations enable row level security;

drop policy if exists "Shared generations are viewable by everyone" on generations;
create policy "Shared generations are viewable by everyone"
  on generations for select using (is_shared = true or auth.uid() = user_id);

drop policy if exists "Users can insert own generations" on generations;
create policy "Users can insert own generations"
  on generations for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own generations" on generations;
create policy "Users can update own generations"
  on generations for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own generations" on generations;
create policy "Users can delete own generations"
  on generations for delete using (auth.uid() = user_id);

-- ============================================================
-- LIKES
-- ============================================================
create table if not exists likes (
  id uuid primary key default uuid_generate_v4(),
  generation_id uuid not null references generations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(generation_id, user_id)
);

alter table likes enable row level security;

drop policy if exists "Likes are viewable by everyone" on likes;
create policy "Likes are viewable by everyone"
  on likes for select using (true);

drop policy if exists "Users can manage own likes" on likes;
create policy "Users can manage own likes"
  on likes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own likes" on likes;
create policy "Users can delete own likes"
  on likes for delete using (auth.uid() = user_id);

-- ============================================================
-- COMMENTS
-- ============================================================
create table if not exists comments (
  id uuid primary key default uuid_generate_v4(),
  generation_id uuid not null references generations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table comments enable row level security;

drop policy if exists "Comments are viewable by everyone" on comments;
create policy "Comments are viewable by everyone"
  on comments for select using (true);

drop policy if exists "Users can insert own comments" on comments;
create policy "Users can insert own comments"
  on comments for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own comments" on comments;
create policy "Users can delete own comments"
  on comments for delete using (auth.uid() = user_id);

-- ============================================================
-- FOLLOWS
-- ============================================================
create table if not exists follows (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

alter table follows enable row level security;

drop policy if exists "Follows are viewable by everyone" on follows;
create policy "Follows are viewable by everyone"
  on follows for select using (true);

drop policy if exists "Users can manage own follows" on follows;
create policy "Users can manage own follows"
  on follows for insert with check (auth.uid() = follower_id);

drop policy if exists "Users can delete own follows" on follows;
create policy "Users can delete own follows"
  on follows for delete using (auth.uid() = follower_id);

-- ============================================================
-- TOKEN TRANSACTIONS
-- ============================================================
create table if not exists token_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount integer not null,
  type text not null check (type in ('generation', 'purchase', 'welcome', 'refund')),
  reference_id uuid,
  description text,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'token_transactions_type_check'
  ) then
    alter table token_transactions
      drop constraint token_transactions_type_check;
  end if;

  alter table token_transactions
    add constraint token_transactions_type_check
    check (type in ('generation', 'purchase', 'welcome', 'refund'));
end $$;

alter table token_transactions enable row level security;

drop policy if exists "Users can view own transactions" on token_transactions;
create policy "Users can view own transactions"
  on token_transactions for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on token_transactions;
create policy "Users can insert own transactions"
  on token_transactions for insert with check (auth.uid() = user_id);

drop policy if exists "Trigger can insert transactions" on token_transactions;
create policy "Trigger can insert transactions"
  on token_transactions for insert with check (true);

-- ============================================================
-- TRIGGER: Auto-create profile + grant welcome tokens on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
  attempt int := 0;
begin
  -- derive a sanitized base username from email, or fall back to UUID prefix
  if new.email is not null and new.email != '' then
    base_username := regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g');
  else
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  -- guard against empty result
  if base_username is null or base_username = '' then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  -- loop until a unique username is found
  final_username := base_username;
  while exists (select 1 from profiles where username = final_username) loop
    attempt := attempt + 1;
    final_username := base_username || '_' || attempt;
  end loop;

  insert into profiles (id, username, full_name, avatar_url, token_balance)
  values (
    new.id,
    final_username,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url',
    10
  )
  on conflict (id) do nothing;

  insert into token_transactions (user_id, amount, type, description)
  values (new.id, 10, 'welcome', 'Welcome bonus tokens')
  on conflict do nothing;

  return new;

exception when others then
  -- Log the error but never abort auth user creation
  raise warning 'handle_new_user failed for %: % %', new.id, sqlerrm, sqlstate;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- INDEX hints for performance
-- ============================================================
create index if not exists generations_user_id_idx on generations(user_id);
create index if not exists generations_is_shared_idx on generations(is_shared);
create index if not exists generations_created_at_idx on generations(created_at desc);
create index if not exists likes_generation_id_idx on likes(generation_id);
create index if not exists comments_generation_id_idx on comments(generation_id);
create index if not exists follows_follower_idx on follows(follower_id);
create index if not exists follows_following_idx on follows(following_id);

-- ============================================================
-- AI MODELS
-- ============================================================
create table if not exists ai_models (
  id text primary key,
  name text not null,
  description text not null default '',
  tier text not null check (tier in ('low', 'mid', 'high')),
  provider text not null check (provider in ('openai', 'openrouter')),
  tokens_per_generation integer not null default 5,
  price_estimate text not null default '',
  supports_image_input boolean not null default true,
  max_resolution text,
  recommended boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_models enable row level security;

drop policy if exists "AI models are viewable by everyone" on ai_models;
create policy "AI models are viewable by everyone"
  on ai_models for select using (true);

drop policy if exists "Only admins can insert ai_models" on ai_models;
create policy "Only admins can insert ai_models"
  on ai_models for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Only admins can update ai_models" on ai_models;
create policy "Only admins can update ai_models"
  on ai_models for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Only admins can delete ai_models" on ai_models;
create policy "Only admins can delete ai_models"
  on ai_models for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create index if not exists ai_models_is_active_idx on ai_models(is_active);
create index if not exists ai_models_sort_order_idx on ai_models(sort_order);
