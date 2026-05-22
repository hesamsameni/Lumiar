-- ============================================================
-- Referral system migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add referral_code to profiles (if not already there)
alter table profiles
  add column if not exists referral_code text unique;

-- Backfill referral codes for existing users who don't have one
update profiles
set referral_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where referral_code is null;

-- Make it not nullable going forward and set a default
alter table profiles
  alter column referral_code set not null,
  alter column referral_code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

create unique index if not exists profiles_referral_code_idx on profiles(referral_code);

-- 2. Create referrals table
create table if not exists referrals (
  id            uuid primary key default uuid_generate_v4(),
  referrer_id   uuid not null references profiles(id) on delete cascade,
  referred_id   uuid not null references profiles(id) on delete cascade,
  credits_each  integer not null default 50,
  created_at    timestamptz not null default now(),
  credits_awarded_at timestamptz,
  unique(referred_id)  -- each user can only be referred once
);

alter table referrals enable row level security;

drop policy if exists "Users can view own referrals" on referrals;
create policy "Users can view own referrals"
  on referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);

create index if not exists referrals_referrer_id_idx on referrals(referrer_id);

-- 3. Fix the token_transactions type check to include 'referral'
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'token_transactions_type_check'
  ) then
    alter table token_transactions
      drop constraint token_transactions_type_check;
  end if;

  alter table token_transactions
    add constraint token_transactions_type_check
    check (type in ('generation', 'purchase', 'welcome', 'refund', 'referral'));
end $$;

-- 4. Create the claim_referral RPC function
create or replace function claim_referral(
  p_referral_code text,
  p_referred_id   uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id   uuid;
  v_credits_each  integer := 50;
  v_existing_id   uuid;
begin
  -- Find the referrer
  select id into v_referrer_id
  from profiles
  where referral_code = p_referral_code;

  if v_referrer_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Cannot refer yourself
  if v_referrer_id = p_referred_id then
    return jsonb_build_object('ok', false, 'error', 'self_referral');
  end if;

  -- Check if already claimed
  select id into v_existing_id
  from referrals
  where referred_id = p_referred_id;

  if v_existing_id is not null then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  -- Insert the referral record
  insert into referrals (referrer_id, referred_id, credits_each, credits_awarded_at)
  values (v_referrer_id, p_referred_id, v_credits_each, now());

  -- Credit the referrer
  update profiles
  set token_balance = token_balance + v_credits_each,
      updated_at    = now()
  where id = v_referrer_id;

  insert into token_transactions (user_id, amount, type, description)
  values (v_referrer_id, v_credits_each, 'referral', 'Referral bonus — friend joined');

  -- Credit the new user (referred)
  update profiles
  set token_balance = token_balance + v_credits_each,
      updated_at    = now()
  where id = p_referred_id;

  insert into token_transactions (user_id, amount, type, description)
  values (p_referred_id, v_credits_each, 'referral', 'Referral bonus — joined via invite');

  return jsonb_build_object(
    'ok',           true,
    'referrer_id',  v_referrer_id,
    'credits_each', v_credits_each
  );

exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

-- Grant execute to authenticated and service_role
grant execute on function claim_referral(text, uuid) to authenticated;
grant execute on function claim_referral(text, uuid) to service_role;
