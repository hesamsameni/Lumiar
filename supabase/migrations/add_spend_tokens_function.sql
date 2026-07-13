-- ============================================================
-- Atomic token spend for image generation
-- Deducts p_amount from the user's balance ONLY if they can
-- afford it, in a single statement (no read-modify-write race).
-- Returns true when the deduction happened, false otherwise.
-- Run this in the Supabase SQL Editor.
-- ============================================================

create or replace function spend_tokens(p_user_id uuid, p_amount integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  -- Nothing to charge — treat as success.
  if p_amount is null or p_amount <= 0 then
    return true;
  end if;

  update profiles
  set
    token_balance = token_balance - p_amount,
    updated_at    = now()
  where id = p_user_id
    and token_balance >= p_amount;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
