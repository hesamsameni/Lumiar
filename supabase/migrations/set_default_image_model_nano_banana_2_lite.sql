-- ============================================================
-- Ensure Nano Banana 2 Lite is marked recommended.
--
-- `recommended` is a UI badge and can be true on multiple models.
-- The app default for new users is chosen separately in useModels
-- (DEFAULT_IMAGE_MODEL_ID), not by clearing other recommended flags.
-- ============================================================

update ai_models
set recommended = true
where id = 'google/gemini-3.1-flash-lite-image';
