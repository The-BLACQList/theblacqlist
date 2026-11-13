-- =============================================================================
-- Migration: messaging "send as your page" + the "Email us" button type
-- (owner-experience round 2, part A, 2026-11-13)
-- =============================================================================
-- Additive only. Safe to apply before or after the code that uses it deploys:
-- nothing reads the new column or writes the new CHECK value until then.
--
-- What changes:
--   1. conversations.customer_listing_id uuid NULL -> listings(id).
--      The page the customer side is writing as. NULL = a person (today's
--      behaviour). Set once, when the thread is created, by the
--      startConversation action, which checks the caller owns that page and
--      that it is published. ON DELETE SET NULL: if that page is deleted the
--      thread stays, and shows the person instead.
--      The UNIQUE (listing_id, customer_user_id) constraint is kept: a person
--      still has one thread per business, whichever page they first wrote as.
--      The inbox puts a thread under "Businesses" when this column is set.
--   2. listing_details_business.cta_type gains 'email' ("Email us", a mailto:
--      button). 'message' becomes the in-app inbox only.
--
-- The matching data fix (message + email address -> email) is a separate
-- migration, 20261113000004, because the code on main does not know 'email'
-- and would render a broken button. Apply 000004 only after the code deploys.
--
-- RLS: unchanged. Conversations stay visible to customer_user_id and to the
-- owner of listing_id. The sending page's name and logo are read with the
-- service client for threads RLS has already returned.
--
-- Down:
--   ALTER TABLE public.conversations DROP COLUMN IF EXISTS customer_listing_id;
--   UPDATE public.listing_details_business SET cta_type = 'message'
--     WHERE cta_type = 'email';      -- only if 000004 has run
--   then re-add the CHECK without 'email' (see 20260524000001).
-- =============================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS customer_listing_id uuid NULL
    REFERENCES public.listings(id) ON DELETE SET NULL;

-- The Businesses tab filters on it, and ON DELETE SET NULL needs it to find rows.
CREATE INDEX IF NOT EXISTS conversations_customer_listing_idx
  ON public.conversations (customer_listing_id)
  WHERE customer_listing_id IS NOT NULL;

ALTER TABLE public.listing_details_business
  DROP CONSTRAINT IF EXISTS listing_details_business_cta_type_check;
ALTER TABLE public.listing_details_business
  ADD CONSTRAINT listing_details_business_cta_type_check
  CHECK (cta_type IN ('book','order','call','message','email','visit','get-quote','shop',
                      'subscribe','contact','commission','inquire','get-tickets','rsvp',
                      'register','learn-more','apply','buy-now'));
