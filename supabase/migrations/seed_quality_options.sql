-- ============================================================
-- SEED quality/resolution options + re-tune base credit costs.
--
-- Base `tokens_per_generation` is treated as the cost of the DEFAULT tier
-- (multiplier 1). Higher tiers scale up via their multiplier. Credits target
-- ~2x provider cost (~$0.0083/credit), i.e. credits ~= usd * 241.
--
-- Quality maps to each provider's native knob: OpenAI `quality` (medium/high),
-- Gemini `imageSize` (1K/2K/4K), and OpenRouter `resolution` (1K/2K/4K via the
-- /images router). Runs by id, so missing rows are simply skipped.
-- ============================================================

-- ---------- Google Gemini image models (imageConfig.imageSize) ----------

-- Nano Banana Pro (Gemini 3 Pro Image): 1K/2K cost the same, so Standard = 2K.
update ai_models set
  tokens_per_generation = 32,
  default_quality = 'standard',
  quality_options = '[
    {"value":"standard","label":"Standard (2K)","hint":"Best for web, social & everyday sharing","param":"2K","multiplier":1},
    {"value":"ultra","label":"Ultra (4K)","hint":"Best for print, large displays & fine detail","param":"4K","multiplier":1.8}
  ]'::jsonb
where id = 'google/gemini-3-pro-image';

-- Nano Banana 2 (Gemini 3.1 Flash Image): distinct 1K / 2K / 4K pricing.
update ai_models set
  tokens_per_generation = 16,
  default_quality = 'standard',
  quality_options = '[
    {"value":"standard","label":"Standard (1K)","hint":"Best for quick drafts & high-volume iteration","param":"1K","multiplier":1},
    {"value":"high","label":"High (2K)","hint":"Best for crisp posts & detailed thumbnails","param":"2K","multiplier":1.5},
    {"value":"ultra","label":"Ultra (4K)","hint":"Best for print & large-format output","param":"4K","multiplier":2.25}
  ]'::jsonb
where id = 'google/gemini-3.1-flash-image';

-- ---------- OpenAI gpt-image* (quality: medium/high) ----------

update ai_models set
  tokens_per_generation = 10,
  default_quality = 'standard',
  quality_options = '[
    {"value":"standard","label":"Standard","hint":"Best for everyday images & fast iteration","param":"medium","multiplier":1},
    {"value":"high","label":"High","hint":"Best for photorealism & fine detail","param":"high","multiplier":4}
  ]'::jsonb
where id = 'openai/gpt-image-2';

update ai_models set
  tokens_per_generation = 3,
  default_quality = 'standard',
  quality_options = '[
    {"value":"standard","label":"Standard","hint":"Best for cheap, high-volume drafts","param":"medium","multiplier":1},
    {"value":"high","label":"High","hint":"Best for sharper, more detailed results","param":"high","multiplier":3}
  ]'::jsonb
where id = 'openai/gpt-image-1-mini';

update ai_models set
  tokens_per_generation = 10,
  default_quality = 'standard',
  quality_options = '[
    {"value":"standard","label":"Standard","hint":"Best for everyday images & fast iteration","param":"medium","multiplier":1},
    {"value":"high","label":"High","hint":"Best for photorealism & fine detail","param":"high","multiplier":4}
  ]'::jsonb
where id = 'openai/gpt-image-1';

-- ---------- OpenRouter image models (POST /images: resolution tier) ----------
-- OpenRouter's image router accepts a normalized `resolution` (512/1K/2K/4K);
-- providers without a resolution knob ignore it. Base cost is kept as the 1K
-- "standard" tier (multiplier 1); higher tiers scale up. Only enabled/raster
-- models get tiers (vector Recraft variants are left without a control).

-- Seedream (Seed provider) requires a large minimum image size (~3.69MP), so 1K
-- is rejected — its tiers start at 2K.
update ai_models set
  default_quality = 'standard',
  quality_options = '[
    {"value":"standard","label":"Standard (2K)","hint":"Best for detailed images & everyday use","param":"2K","multiplier":1},
    {"value":"ultra","label":"Ultra (4K)","hint":"Best for print & fine detail","param":"4K","multiplier":1.7}
  ]'::jsonb
where id = 'bytedance-seed/seedream-4.5';

-- 1K / 2K models. (FLUX.2 caps at 4MP = 2K; Recraft/Riverflow top out at 2K.)
update ai_models set
  default_quality = 'standard',
  quality_options = '[
    {"value":"standard","label":"Standard (1K)","hint":"Best for web, social & fast iteration","param":"1K","multiplier":1},
    {"value":"high","label":"High (2K)","hint":"Best for crisp detail & larger displays","param":"2K","multiplier":1.6}
  ]'::jsonb
where id in (
  'black-forest-labs/flux.2-pro',
  'black-forest-labs/flux.2-max',
  'black-forest-labs/flux.2-flex',
  'black-forest-labs/flux.2-klein-4b',
  'recraft/recraft-v3',
  'recraft/recraft-v4',
  'recraft/recraft-v4-pro',
  'recraft/recraft-v4.1',
  'recraft/recraft-v4.1-pro',
  'sourceful/riverflow-v2.5-pro',
  'sourceful/riverflow-v2.5-fast',
  'x-ai/grok-imagine-image-quality',
  'microsoft/mai-image-2.5'
);

-- ---------- Video resolution options (OpenRouter `resolution`) ----------
-- Base cost was tuned for each model's current `resolution`, so that tier keeps
-- multiplier 1; the other tier scales up (going higher) or down (going lower).

update video_models set
  default_resolution = '720p',
  resolution_options = '[
    {"value":"720p","label":"720p · Standard","hint":"Best for social clips & fast previews","multiplier":1},
    {"value":"1080p","label":"1080p · High","hint":"Best for crisp, detailed final videos","multiplier":1.8}
  ]'::jsonb
where resolution = '720p';

update video_models set
  default_resolution = '1080p',
  resolution_options = '[
    {"value":"720p","label":"720p · Faster","hint":"Best for quick, cheaper drafts","multiplier":0.6},
    {"value":"1080p","label":"1080p · Standard","hint":"Best for crisp, detailed final videos","multiplier":1}
  ]'::jsonb
where resolution = '1080p';

-- Grok Imagine Video 1.5: OpenRouter bills 480p/720p/1080p separately
-- ($0.08 / $0.14 / $0.25 per second). Multipliers are relative to 720p.
update video_models set
  default_resolution = '720p',
  resolution_options = '[
    {"value":"480p","label":"480p · Fast","hint":"Best for cheap drafts & quick previews","multiplier":0.57},
    {"value":"720p","label":"720p · Standard","hint":"Best for social clips","multiplier":1},
    {"value":"1080p","label":"1080p · High","hint":"Best for crisp, detailed final videos","multiplier":1.8}
  ]'::jsonb
where id = 'x-ai/grok-imagine-video-1.5';
