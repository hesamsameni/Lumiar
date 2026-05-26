alter table prompt_items
  add column if not exists placeholders jsonb not null default '[]'::jsonb;
