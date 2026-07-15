-- ============================================================
-- Rewrite image model descriptions into concise "best for X" text so the model
-- picker tells users what each model is good for (and fits the sidebar without
-- being truncated). Only updates rows that exist.
-- ============================================================
update ai_models set description = 'Best for fast, affordable everyday images and quick edits with image input.'
  where id = 'google/gemini-2.5-flash-image';

update ai_models set description = 'Higher-quality Gemini with extended aspect ratios — great for detailed everyday images and edits.'
  where id = 'google/gemini-3.1-flash-image';

update ai_models set description = 'Google''s most advanced — best for in-image text, infographics, multi-subject scenes and pro compositions (2K/4K).'
  where id = 'google/gemini-3-pro-image';

update ai_models set description = 'Best for the highest fidelity and detailed edits — photorealistic results up to 4K.'
  where id = 'openai/gpt-image-2';

update ai_models set description = 'Reliable all-rounder with strong prompt adherence — great for edits.'
  where id = 'openai/gpt-image-1';

update ai_models set description = 'Fast and affordable — best for quick drafts and rapid iteration.'
  where id = 'openai/gpt-image-1-mini';

update ai_models set description = 'Vivid, stylized visuals — great for creative and artistic scenes.'
  where id = 'bytedance-seed/seedream-4.5';

update ai_models set description = 'Photorealistic with accurate in-image text — best for posters, ads, packaging and social graphics.'
  where id = 'x-ai/grok-imagine-image-quality';

update ai_models set description = 'Photorealistic and artistic generation — a solid choice for general high-quality visuals.'
  where id = 'microsoft/mai-image-2.5';

update ai_models set description = 'Photorealistic detail and sharpness — best for realistic, high-detail scenes.'
  where id = 'black-forest-labs/flux.2-pro';

update ai_models set description = 'Flexible output sizes at good quality — best for varied resolutions on a budget.'
  where id = 'black-forest-labs/flux.2-flex';

update ai_models set description = 'Design-focused — best for logos, icons, color palettes and text layout.'
  where id = 'recraft/recraft-v3';

update ai_models set description = 'Design-focused with strong composition — best for product and editorial art.'
  where id = 'recraft/recraft-v4';

update ai_models set description = 'Highest-fidelity design at 2K — best for polished logos, product and editorial work.'
  where id = 'recraft/recraft-v4-pro';
