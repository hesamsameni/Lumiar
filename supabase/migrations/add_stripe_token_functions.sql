-- ============================================================
-- Atomic token increment for Stripe purchases
-- Run this in Supabase SQL Editor
-- ============================================================

create or replace function add_tokens_to_user(p_user_id uuid, p_amount integer)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
  set
    token_balance = token_balance + p_amount,
    updated_at    = now()
  where id = p_user_id;
$$;
