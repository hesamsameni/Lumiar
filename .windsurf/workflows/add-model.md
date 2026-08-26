---
description: Add a new image or video generation model from OpenRouter to Lumiar
---

# Add a New Generation Model from OpenRouter

When the user provides an OpenRouter model URL (e.g. `https://openrouter.ai/<maker>/<model>?output_modalities=image` or `…?output_modalities=video`), follow these steps to add it to the platform.

---

## Step 0 — Gather Model Details from OpenRouter

1. Open the provided OpenRouter URL and extract:
   - **Model ID**: the `<maker>/<model-slug>` path (this becomes the DB `id`)
   - **Display name**: human-friendly name
   - **Pricing**: per-image USD cost (images) or per-second USD cost (video)
   - **Capabilities**: image input support, max reference inputs, aspect ratios, resolutions, durations, audio support, last-frame, video input, etc.
   - **Quality/resolution tiers and their pricing** (if multiple exist)

2. If the OpenRouter page is unavailable, check the API directly:
   - Images: `GET https://openrouter.ai/api/v1/images/models`
   - Videos: `GET https://openrouter.ai/api/v1/videos/models`

---

## Step 1 — Determine Credit Pricing

Our pricing formula targets **~2× provider cost** per credit:

- **1 Lumiar credit ≈ $0.0083** (based on our largest credit pack)
- **Credits = round(provider_usd_cost × 241)**

### Image Models

- `tokens_per_generation` = credits for one image at the **default** quality tier
- Formula: `round(usd_per_image × 241)`
- Example: $0.04/image → `round(0.04 × 241)` = **10 credits**
- If the model has multiple quality/resolution tiers, the base `tokens_per_generation` is set for the **cheapest/default** tier; higher tiers use a `multiplier` in `quality_options`

### Video Models

- `tokens_per_generation` = credits for one clip at the **default duration** and **default resolution**
- Formula: `round(usd_per_second × default_duration_seconds × 241)`
- Example: $0.14/s × 5s default → `round(0.14 × 5 × 241)` = **169 ≈ 170 credits**
- Credits scale linearly with user-selected duration (handled automatically by the app)
- Resolution multipliers go in `resolution_options`

### Tier Classification

- **low**: cheapest models (provider cost < ~$0.06/image or < ~$0.10/s video)
- **mid**: mid-range (provider cost ~$0.06–$0.15/image or ~$0.10–$0.25/s video)
- **high**: premium (provider cost > $0.15/image or > $0.25/s video)

---

## Step 1b — Company Logo & Registration (New Companies Only)

Models are grouped by company in the picker. The company is inferred from the model ID prefix (e.g. `alibaba/wan-3.0` → `alibaba`). If the model is from a company **already in the app**, skip this step.

**Existing companies** (have logos in `public/ai-logos/`):
google, openai, recraft, black-forest-labs, bytedance (alias: bytedance-seed), x-ai, microsoft, sourceful, krea, qwen, alibaba, kuaishou, minimax, runway

### If the company is NEW:

1. **Add an SVG logo** to `public/ai-logos/<company>.svg`
   - Must be a simple, monochrome-friendly SVG (the app inverts it for dark mode via CSS filter)
   - Download from the company's branding page or OpenRouter's model page
   - Cascade **cannot create SVG logo files** — ask the user to provide or download the logo

2. **Register the company** in `app/utils/modelCompanies.ts`:

   For **image models**, add to `IMAGE_COMPANY_META`:

   ```ts
   "<company-key>": {
     label: "<Display Name>",
     subtitle: "<Model Family> family",
     logo: "/ai-logos/<company>.svg",
   },
   ```

   And add the key to `IMAGE_COMPANY_ORDER` array.

   For **video models**, add to `VIDEO_COMPANY_META`:

   ```ts
   "<company-key>": {
     label: "<Display Name>",
     subtitle: "<Model Family> family",
     logo: "/ai-logos/<company>.svg",
   },
   ```

   And add the key to `VIDEO_COMPANY_ORDER` array.

3. **If the model ID prefix differs from the company key**, add an alias:
   - Image: add to `IMAGE_COMPANY_ID_MAP`, e.g. `"bytedance-seed": "bytedance"`
   - Video: add to `MAKER_ALIASES`, e.g. `"bytedance-seed": "bytedance"`

**If the company is missing and no logo is provided**, the picker shows a generic fallback icon (Lucide `layers` for images, `clapperboard` for videos). The model still works — the logo is cosmetic only.

---

## Step 2 — Create the SQL Migration

Create a new file: `supabase/migrations/add_<model_slug>.sql`

### For Image Models

Insert into `ai_models`. Key columns:

| Column                  | Type    | Description                                                            |
| ----------------------- | ------- | ---------------------------------------------------------------------- |
| `id`                    | text PK | OpenRouter model ID, e.g. `bytedance-seed/seedream-5-0-lite`           |
| `name`                  | text    | Display name, e.g. `Seedream 5.0 Lite`                                 |
| `description`           | text    | Short description of the model                                         |
| `tier`                  | text    | `low`, `mid`, or `high`                                                |
| `provider`              | text    | Always `openrouter` for OpenRouter models                              |
| `tokens_per_generation` | int     | Base credit cost (default quality tier)                                |
| `price_estimate`        | text    | Human-readable, e.g. `~$0.035/image`                                   |
| `supports_image_input`  | bool    | Whether the model accepts input images for editing                     |
| `max_image_inputs`      | int     | Max reference images (from OpenRouter `input_references`)              |
| `max_resolution`        | text    | Max output resolution, e.g. `2048×2048`                                |
| `quality_options`       | jsonb   | Array of `{value, label, hint, param, multiplier}` — see format below  |
| `default_quality`       | text    | Default quality tier value                                             |
| `recommended`           | bool    | Whether to show a "recommended" badge (usually `false` for new models) |
| `is_active`             | bool    | Set to `false` to add without exposing in the picker                   |
| `sort_order`            | int     | Position in the model picker                                           |

**quality_options format** (jsonb array):

```json
[
  {
    "value": "standard",
    "label": "Standard (1K)",
    "hint": "Best for web & social",
    "param": "1K",
    "multiplier": 1
  },
  {
    "value": "high",
    "label": "High (2K)",
    "hint": "Best for crisp detail",
    "param": "2K",
    "multiplier": 1.6
  }
]
```

- `param` is the value sent to the OpenRouter API (`resolution` field for images, `quality` for OpenAI)
- `multiplier` scales the base `tokens_per_generation`

**Template SQL:**

```sql
-- ============================================================
-- ADD: <model-id> (OpenRouter, <month> <year>)
--
-- Source: OpenRouter model page / API
-- Pricing: $X.XX/image
-- Credits: round(X.XX × 241) = N tokens
-- ============================================================
insert into ai_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, supports_image_input,
  max_image_inputs, max_resolution, quality_options, default_quality,
  recommended, is_active, sort_order
) values (
  '<maker/model-id>',
  '<Display Name>',
  '<Description>',
  '<tier>',
  'openrouter',
  <credits>,
  '~$X.XX/image',
  <true|false>,
  <max_inputs>,
  '<WxH>',
  '<quality_options_json>'::jsonb,
  '<default_quality>',
  false,
  false,
  <sort_order>
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  tier = excluded.tier,
  provider = excluded.provider,
  tokens_per_generation = excluded.tokens_per_generation,
  price_estimate = excluded.price_estimate,
  supports_image_input = excluded.supports_image_input,
  max_image_inputs = excluded.max_image_inputs,
  max_resolution = excluded.max_resolution,
  quality_options = excluded.quality_options,
  default_quality = excluded.default_quality,
  updated_at = now();
```

### For Video Models

Insert into `video_models`. Additional columns beyond image models:

| Column                      | Type   | Description                                                      |
| --------------------------- | ------ | ---------------------------------------------------------------- |
| `duration_seconds`          | int    | Default clip duration                                            |
| `supported_durations`       | int[]  | Array of selectable durations, e.g. `{4,5,6,7,8}`                |
| `resolution`                | text   | Default resolution, e.g. `720p`                                  |
| `resolution_options`        | jsonb  | Array of `{value, label, hint, multiplier}` for resolution tiers |
| `default_resolution`        | text   | Default resolution value                                         |
| `supports_image_input`      | bool   | Accepts first-frame / reference image                            |
| `supports_last_frame`       | bool   | Accepts last-frame image (frame interpolation)                   |
| `supports_video_input`      | bool   | Accepts reference/source video                                   |
| `supports_audio_input`      | bool   | Accepts audio track (lip-sync)                                   |
| `supports_audio_generation` | bool   | Can generate synchronized audio                                  |
| `max_references`            | int    | Max combined reference images + videos (0=none)                  |
| `max_reference_videos`      | int    | Of those, how many may be videos                                 |
| `supported_aspect_ratios`   | text[] | e.g. `{"16:9","9:16","1:1"}`                                     |

**resolution_options format** (jsonb array):

```json
[
  {
    "value": "720p",
    "label": "720p · Standard",
    "hint": "Best for social clips",
    "multiplier": 1
  },
  {
    "value": "1080p",
    "label": "1080p · High",
    "hint": "Best for crisp final videos",
    "multiplier": 1.8
  }
]
```

**Template SQL:**

```sql
-- ============================================================
-- ADD: <model-id> (OpenRouter, <month> <year>)
--
-- Source: OpenRouter model page / API
-- Pricing: $X.XX/s at default resolution
-- Credits: round(X.XX × default_duration × 241) = N tokens @ Ns
-- ============================================================
insert into video_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, duration_seconds, supported_durations,
  resolution, resolution_options, default_resolution,
  supports_image_input, supports_last_frame,
  supports_video_input, supports_audio_input, supports_audio_generation,
  max_references, max_reference_videos,
  supported_aspect_ratios,
  recommended, is_active, sort_order
) values (
  '<maker/model-id>',
  '<Display Name>',
  '<Description>',
  '<tier>',
  'openrouter',
  <credits>,
  '~$X.XX/s',
  <default_duration>,
  '{<comma-separated durations>}',
  '<default_resolution>',
  '<resolution_options_json>'::jsonb,
  '<default_resolution>',
  <supports_image_input>,
  <supports_last_frame>,
  <supports_video_input>,
  <supports_audio_input>,
  <supports_audio_generation>,
  <max_references>,
  <max_reference_videos>,
  '{"16:9","9:16","1:1"}',
  false,
  false,
  <sort_order>
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  tier = excluded.tier,
  tokens_per_generation = excluded.tokens_per_generation,
  price_estimate = excluded.price_estimate,
  duration_seconds = excluded.duration_seconds,
  supported_durations = excluded.supported_durations,
  resolution = excluded.resolution,
  resolution_options = excluded.resolution_options,
  default_resolution = excluded.default_resolution,
  supports_image_input = excluded.supports_image_input,
  supports_last_frame = excluded.supports_last_frame,
  supports_video_input = excluded.supports_video_input,
  supports_audio_input = excluded.supports_audio_input,
  supports_audio_generation = excluded.supports_audio_generation,
  max_references = excluded.max_references,
  max_reference_videos = excluded.max_reference_videos,
  supported_aspect_ratios = excluded.supported_aspect_ratios,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
```

---

## Step 3 — Run the Migration (Manual — User Action Required)

Cascade does **not** have direct database access. After creating the migration file, ask the user to run it via one of:

1. **Supabase Dashboard** → SQL Editor → paste the file contents and execute
2. **CLI** (if `DATABASE_URL` is available): `psql "$DATABASE_URL" -f supabase/migrations/add_<model_slug>.sql`

---

## Step 4 — Verify

1. The model should now appear in the **Admin Dashboard → Models** (for images) or **Admin Dashboard → Video Models** (for videos).
2. If `is_active = false`, the model is hidden from the user picker but visible to admins. Toggle `is_active` via the admin UI when ready to go live.
3. No code changes are needed — the app reads models dynamically from the database via:
   - Images: `GET /api/models` → reads `ai_models` table
   - Videos: `GET /api/video-models` → reads `video_models` table

---

## Step 5 — No Code Changes Needed

Both image and video generation backends route through OpenRouter automatically:

- **Images**: `server/api/generate.post.ts` → `server/utils/providers/openrouter.ts` (uses the `model` field from DB)
- **Videos**: `server/api/generate-video.post.ts` → `server/utils/providers/openrouter-video.ts` (uses the `model` field from DB)

The model ID in the database **is** the OpenRouter model identifier, so no provider-mapping code is required.

---

## Reference: Existing Model Examples

### Image Model — Seedream 5.0 Lite

- ID: `bytedance-seed/seedream-5-0-lite`
- Provider cost: $0.035/image flat
- Credits: `round(0.035 × 241)` = 8 → set to **6** (adjusted down)
- Tier: `low`
- `max_image_inputs`: 14
- Quality tiers: Standard (2K, multiplier 1), Ultra (4K, multiplier 1)

### Video Model — Grok Imagine Video 1.5

- ID: `x-ai/grok-imagine-video-1.5`
- Provider cost: $0.14/s at 720p
- Credits: `round(0.14 × 5 × 241)` = 169 → set to **170**
- Tier: `mid`
- Default duration: 5s, supported: 1–15s
- Resolution tiers: 480p (×0.57), 720p (×1), 1080p (×1.8)

### Video Model — Seedance 2.5

- ID: `bytedance/seedance-2.5`
- Provider cost: ~$0.23/s
- Credits: `round(0.23 × 5 × 241)` = 277 → set to **290**
- Tier: `high`
- Capabilities: image input, last frame, video input, audio input, audio generation
- `max_references`: 40, `max_reference_videos`: 10

---

## Key Files Reference

| File                                                    | Purpose                                          |
| ------------------------------------------------------- | ------------------------------------------------ |
| `supabase/schema.sql`                                   | `ai_models` table definition                     |
| `supabase/migrations/add_video_models.sql`              | `video_models` table definition                  |
| `supabase/migrations/seed_video_models.sql`             | Full video model catalog seed                    |
| `supabase/migrations/seed_quality_options.sql`          | Quality/resolution options seed                  |
| `supabase/migrations/add_video_audio_input_support.sql` | Audio/video capability columns                   |
| `supabase/migrations/add_multi_reference_support.sql`   | Multi-reference columns                          |
| `app/utils/models.ts`                                   | `AIModel` TypeScript interface                   |
| `app/utils/videoModels.ts`                              | `VideoModel` TypeScript interface                |
| `app/utils/quality.ts`                                  | `QualityOption` interface and credit calculation |
| `server/api/generate.post.ts`                           | Image generation endpoint                        |
| `server/api/generate-video.post.ts`                     | Video generation endpoint                        |
| `server/api/admin/models/index.post.ts`                 | Admin create image model API                     |
| `server/api/admin/video-models/index.post.ts`           | Admin create video model API                     |
