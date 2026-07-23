-- ============================================================
-- Add the Krea 2 image-generation family (source: OpenRouter dedicated
-- Image API — /api/v1/images/models, verified Jul 2026).
--
-- Krea models are served via OpenRouter (provider = 'openrouter'), matching the
-- existing strategy (Google direct, OpenAI direct, everything else OpenRouter).
--
-- All three are text+image -> image, 1K output, and accept up to 1 reference
-- image (input_references max 1 -> max_image_inputs = 1). They expose no
-- quality/resolution tiers (1K only), so quality_options is left null.
--
-- OpenRouter did not publish per-image pricing for these yet, so credits are
-- ranked by Krea's own positioning (Large > Medium > Medium Turbo) and aligned
-- to Lumiar's existing tier scale; price_estimate values are approximate.
--
-- Added DISABLED (is_active = false) so they appear in the admin panel without
-- changing the live picker — flip is_active to expose them (see note below).
--
-- Idempotent: on conflict, descriptive fields are refreshed but is_active,
-- recommended and sort_order are preserved so admin toggles survive re-runs.
-- ============================================================
insert into ai_models (
  id, name, description, tier, provider,
  tokens_per_generation, price_estimate, supports_image_input,
  max_image_inputs, max_resolution, recommended, is_active, sort_order
) values
  (
    'krea/krea-2-large',
    'Krea 2 Large',
    'Krea''s high-capability model — rawer, more textured and expressive results with flexible character.',
    'high', 'openrouter',
    10, '~$0.06/image', true, 1, '1024×1024', false, false, 20
  ),
  (
    'krea/krea-2-medium',
    'Krea 2 Medium',
    'Balanced, cost-efficient Krea model — stable, consistent generations for a broad range of use cases.',
    'mid', 'openrouter',
    6, '~$0.03/image', true, 1, '1024×1024', false, false, 21
  ),
  (
    'krea/krea-2-medium-turbo',
    'Krea 2 Medium Turbo',
    'Distilled, speed-focused Krea variant — best for rapid iteration and graphic-design exploration.',
    'low', 'openrouter',
    4, '~$0.02/image', true, 1, '1024×1024', false, false, 22
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
  updated_at = now();
-- Note: is_active, recommended and sort_order are intentionally NOT overwritten,
-- so any admin toggles you've made are preserved on re-run.
