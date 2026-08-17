-- ============================================================
-- Backfill provider_cost for historical video generations.
-- Data exported from OpenRouter dashboard (Aug 2025).
-- Safe to re-run (idempotent UPDATE by id).
-- ============================================================

update video_generations set provider_cost = 0.84
where id = '4e180a2d-87f1-40b5-8011-77f372af5b0f';

update video_generations set provider_cost = 0.84
where id = 'b6b20466-ff34-462e-a5be-20d068b2e02c';

update video_generations set provider_cost = 0.84
where id = '0523dd3b-076a-4072-9cf2-21b309f00c84';

update video_generations set provider_cost = 0.84
where id = 'a0f2d922-3324-4196-bed8-4e52482d93b1';

update video_generations set provider_cost = 0.84
where id = '034d0c09-b1bf-47bb-b4d3-36a88e72532e';

update video_generations set provider_cost = 0.84
where id = '09f321ea-2433-4188-8964-992b85b8b68e';

update video_generations set provider_cost = 0.84
where id = 'b28d5b16-aa7a-48a0-b65a-fa74016cfb67';

update video_generations set provider_cost = 0.123
where id = '9638b621-e32d-4e2e-947e-2a3363851d63';

update video_generations set provider_cost = 0.914
where id = '4edaec92-7cad-40fd-974d-4b8429ff5815';

update video_generations set provider_cost = 0.70
where id = '9210a625-0f11-435a-bf51-95c759da9e73';

update video_generations set provider_cost = 0.70
where id = '85c33c6d-ed4a-4c0e-b744-171c709130a3';

update video_generations set provider_cost = 0.494
where id = '82996293-bcd5-4c78-82bd-2aefd99fa4f7';

update video_generations set provider_cost = 0.484
where id = 'cac1b629-e05f-443b-b8f2-3f56877f1889';

update video_generations set provider_cost = 0.494
where id = '527d4990-40b8-425b-9ae6-9bc22218c182';
