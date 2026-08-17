-- ============================================================
-- Add provider_cost column to track actual cost from OpenRouter / provider.
-- Stored as a real (float) in USD. Populated by the polling endpoint when
-- the provider returns usage.cost data.
-- Safe to run on an existing database.
-- ============================================================

alter table generations
  add column if not exists provider_cost real;

alter table video_generations
  add column if not exists provider_cost real;
