-- ============================================================
-- LANDING PAGE EXAMPLES
-- Curated images shown on /ai/<use-case> SEO landing pages.
-- When a use-case has no active rows here, the page falls back
-- to auto-pulling shared community generations by tag.
-- Run this file in the Supabase SQL Editor.
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists landing_page_examples (
  id uuid primary key default uuid_generate_v4(),
  use_case_slug text not null,
  image_url text not null,
  caption text,
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table landing_page_examples enable row level security;

-- Active rows are public; admins can see everything (incl. inactive).
drop policy if exists "Landing examples are viewable by everyone" on landing_page_examples;
create policy "Landing examples are viewable by everyone"
  on landing_page_examples for select
  using (
    is_active = true
    or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Only admins can insert landing_page_examples" on landing_page_examples;
create policy "Only admins can insert landing_page_examples"
  on landing_page_examples for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Only admins can update landing_page_examples" on landing_page_examples;
create policy "Only admins can update landing_page_examples"
  on landing_page_examples for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Only admins can delete landing_page_examples" on landing_page_examples;
create policy "Only admins can delete landing_page_examples"
  on landing_page_examples for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create index if not exists landing_page_examples_slug_idx
  on landing_page_examples(use_case_slug);
create index if not exists landing_page_examples_active_idx
  on landing_page_examples(is_active);
create index if not exists landing_page_examples_sort_idx
  on landing_page_examples(sort_order);
