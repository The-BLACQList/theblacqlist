-- =============================================================================
-- Migration: move "Send a message" buttons that hold an email to "Email us"
-- (owner-experience round 2, part A, 2026-11-13)
-- =============================================================================
-- APPLY ONLY AFTER the code from PR #320 is live. The code on main does not
-- know cta_type 'email' and would render these buttons as a broken link.
-- Requires 20261113000003 (the CHECK that allows 'email').
--
-- Before in-app messaging, "Send a message" stored an email address (or a
-- contact-page link) in cta_url and rendered a mailto:/link button. 'message'
-- now means the in-app inbox, which every page starts with closed, so those
-- pages would show "Not accepting messages". This keeps what each owner
-- chose:
--   message + email address  -> email   ("Email us", same address)
--   message + https link     -> contact ("Contact us", same link)
-- Rows with no cta_url stay 'message' (the inbox button).
-- Until this runs, the new code already renders message + email address as a
-- mailto: while the inbox is closed, so the order is safe either way.
--
-- Down (only rows this changed can't be told apart afterwards, so record them
-- first with the preflight query in the PR's SQL notes):
--   UPDATE public.listing_details_business SET cta_type = 'message'
--     WHERE listing_id IN (<ids from the preflight>);
-- =============================================================================

UPDATE public.listing_details_business
   SET cta_type = 'email'
 WHERE cta_type = 'message'
   AND cta_url ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

UPDATE public.listing_details_business
   SET cta_type = 'contact'
 WHERE cta_type = 'message'
   AND cta_url ~* '^https://';
