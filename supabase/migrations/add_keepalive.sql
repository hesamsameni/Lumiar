-- ============================================================
-- Keepalive — prevents Supabase free-tier auto-pause
-- Supabase pauses projects with no activity for 7 days.
-- An external scheduler (GitHub Actions) calls keepalive_ping()
-- every 3 days to register DB activity.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Single-row table that records the last ping.
create table if not exists keepalive (
  id         smallint primary key default 1,
  last_ping  timestamptz not null default now(),
  ping_count bigint not null default 0,
  constraint keepalive_singleton check (id = 1)
);

-- Seed the single row.
insert into keepalive (id) values (1)
on conflict (id) do nothing;

-- RLS on, with no policies: only the service role (which bypasses RLS)
-- may touch this table. It is never exposed to end users.
alter table keepalive enable row level security;

-- Updates the singleton row and bumps the counter. Called via RPC by the
-- scheduled keep-alive job. security definer so it runs with owner rights.
create or replace function keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update keepalive
     set last_ping = now(),
         ping_count = ping_count + 1
   where id = 1
  returning last_ping;
$$;

-- Only the service role may execute the function.
revoke all on function keepalive_ping() from public, anon, authenticated;
grant execute on function keepalive_ping() to service_role;
