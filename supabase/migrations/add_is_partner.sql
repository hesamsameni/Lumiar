-- Add is_partner flag to profiles.
-- Partners can see provider cost on the usage page (like admin).
alter table profiles
  add column if not exists is_partner boolean not null default false;
