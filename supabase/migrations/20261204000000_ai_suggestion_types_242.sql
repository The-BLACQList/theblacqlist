-- Ticket 242: AI help by plan.
--
-- Three new kinds of AI help write ai_suggestions rows: Happening Now posts
-- ('post_text'), event write-ups ('event_description') and job write-ups
-- ('job_description'). Review replies use 'review_response' and product or
-- service write-ups use 'product_description', which the CHECK already allows.
--
-- The CHECK is replaced with the same list plus the three new values. Every
-- existing row still passes (the list only grows). Staging and prod had the
-- same constraint on 2026-11-21 (read from pg_constraint before writing this).
--
-- DOWN PLAN (only once no row uses a new value):
--   ALTER TABLE ai_suggestions DROP CONSTRAINT IF EXISTS ai_suggestions_suggestion_type_check;
--   ALTER TABLE ai_suggestions ADD CONSTRAINT ai_suggestions_suggestion_type_check
--     CHECK (suggestion_type IN ('page_optimization', 'seo_title', 'seo_description',
--       'listing_description', 'social_caption', 'cta_copy', 'review_response',
--       'analytics_summary', 'product_description', 'collection_suggestion'));

ALTER TABLE ai_suggestions DROP CONSTRAINT IF EXISTS ai_suggestions_suggestion_type_check;

ALTER TABLE ai_suggestions ADD CONSTRAINT ai_suggestions_suggestion_type_check
  CHECK (suggestion_type IN (
    'page_optimization',
    'seo_title',
    'seo_description',
    'listing_description',
    'social_caption',
    'cta_copy',
    'review_response',
    'analytics_summary',
    'product_description',
    'collection_suggestion',
    'post_text',
    'event_description',
    'job_description'
  ));
