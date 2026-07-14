-- ============================================================
-- Allow collections to hold videos as well as images.
-- collection_items originally used a composite PK (collection_id, generation_id),
-- which forces generation_id NOT NULL. We move to a surrogate id PK so a row can
-- be an image OR a video, and re-add the uniqueness as plain constraints.
-- Safe + idempotent on the existing table.
-- ============================================================

-- 1. Add the video reference.
alter table collection_items
  add column if not exists video_generation_id uuid
    references video_generations(id) on delete cascade;

-- 2. Drop the composite primary key so generation_id can become nullable.
alter table collection_items drop constraint if exists collection_items_pkey;

-- 3. Surrogate primary key.
alter table collection_items
  add column if not exists id uuid not null default uuid_generate_v4();
alter table collection_items
  add constraint collection_items_pkey primary key (id);

-- 4. generation_id is now optional (null when the row is a video).
alter table collection_items alter column generation_id drop not null;

-- 5. Re-add per-media uniqueness (NULLs are distinct, so image and video rows
--    never clash with each other).
alter table collection_items
  drop constraint if exists collection_items_collection_generation_key;
alter table collection_items
  add constraint collection_items_collection_generation_key
    unique (collection_id, generation_id);

alter table collection_items
  drop constraint if exists collection_items_collection_video_key;
alter table collection_items
  add constraint collection_items_collection_video_key
    unique (collection_id, video_generation_id);

-- 6. Exactly one of (image, video) must be set per row.
alter table collection_items
  drop constraint if exists collection_items_one_media;
alter table collection_items
  add constraint collection_items_one_media check (
    (generation_id is not null)::int + (video_generation_id is not null)::int = 1
  );
