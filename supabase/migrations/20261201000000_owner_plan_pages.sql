-- =============================================================================
-- Owner-level plans (ticket 238, 2026-11-21).
--
-- [Decision — founder, 2026-11-21] a plan belongs to the owner, not the page.
-- It covers up to: Starter 1 page, Growth 2, Premium 3. Covered pages can be
-- any of the owner's pages (locations of one business or separate
-- businesses). Which pages show each other under "Also At" stays a separate,
-- optional link (listing_location_links, ticket 110).
--
-- What changes:
--   1. subscriptions.listing_id is now only the page the owner started
--      checkout from (the "anchor"). It can be NULL, and deleting that page no
--      longer deletes the subscription row (ON DELETE SET NULL).
--   2. plan_covered_pages: one row for each page the owner's plan covers.
--   3. sync_owner_plan_tiers(owner): the one place that decides each page's
--      tier. Covered pages get the plan's tier; the owner's other pages get
--      'free'. listings.tier stays a per-page copy, so search ranking, RLS and
--      the ~115 files that read it don't change.
--   4. set_plan_page_coverage(owner, add, remove): the owner's "Pages On Your
--      Plan" choice, applied atomically, then synced.
--   5. Backfill: every owner with a live subscription is synced once, keeping
--      the page each subscription is on and its linked locations covered.
--
-- Rules the sync keeps:
--   * Only the server writes. Both functions are SECURITY DEFINER and granted
--     to service_role only; the table has no write policy.
--   * Coverage rows survive a lapse. When the plan ends, every page goes to
--     Free but the rows stay, so resubscribing restores the same pages.
--   * An owner with no subscription rows and no coverage rows is skipped, so
--     tiers the platform set by hand on such an owner's pages are untouched.
--   * A live subscription whose price didn't resolve to a plan skips the sync
--     rather than guess (the webhook logs it).
--   * Jobs and events are never covered; they have their own paid posting.
--   * One owner at a time: a transaction-scoped advisory lock on the owner.
--   * Idempotent: a page's tier is written only when it differs, so a
--     redelivered webhook or a re-run of this file changes nothing.
--
-- Down:
--   DROP FUNCTION IF EXISTS public.set_plan_page_coverage(uuid, uuid[], uuid[]);
--   DROP FUNCTION IF EXISTS public.sync_owner_plan_tiers(uuid, boolean, uuid);
--   DROP TABLE IF EXISTS public.plan_covered_pages;
--   DROP FUNCTION IF EXISTS public.plan_covered_pages_guard();
--   DROP FUNCTION IF EXISTS public.owner_page_cap(uuid);
--   DROP FUNCTION IF EXISTS public.plan_coverable(text);
--   DROP FUNCTION IF EXISTS public.plan_page_cap(text);
--   DROP FUNCTION IF EXISTS public.plan_rank(text);
--   -- Only once no subscription row has a NULL listing_id:
--   ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_listing_id_fkey;
--   ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_listing_id_fkey
--     FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;
--   ALTER TABLE public.subscriptions ALTER COLUMN listing_id SET NOT NULL;
--   Tiers written by the sync stay as they are; the old webhook rewrites a
--   subscribed page's tier on its next event.
-- =============================================================================


-- ─── 1. subscriptions.listing_id becomes the optional anchor ─────────────────

ALTER TABLE public.subscriptions ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_listing_id_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


-- ─── 2. Small pure helpers (mirror lib/stripe/features.ts) ───────────────────

CREATE OR REPLACE FUNCTION public.plan_rank(p_plan text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_plan
    WHEN 'premium' THEN 3
    WHEN 'growth'  THEN 2
    WHEN 'starter' THEN 1
    ELSE 0
  END;
$$;

-- Pages a plan covers. Free is 0 here: this table only records paid coverage.
CREATE OR REPLACE FUNCTION public.plan_page_cap(p_plan text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_plan
    WHEN 'premium' THEN 3
    WHEN 'growth'  THEN 2
    WHEN 'starter' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.plan_coverable(p_entity_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(p_entity_type, '') NOT IN ('job', 'event');
$$;

-- The owner's cap: the sum over live subscriptions. One live subscription per
-- owner is the rule from now on (checkout refuses a second); the sum keeps an
-- owner who already pays for two pages from losing one.
CREATE OR REPLACE FUNCTION public.owner_page_cap(p_owner uuid)
RETURNS int
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(sum(plan_page_cap(p.plan_key)), 0)::int
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = p_owner
    AND s.status IN ('active', 'trialing', 'past_due');
$$;


-- ─── 3. plan_covered_pages ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_covered_pages (
  listing_id    uuid        NOT NULL PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS plan_covered_pages_owner_idx
  ON public.plan_covered_pages (owner_user_id, added_at, listing_id);

-- The page must be the owner's, live and coverable, and the owner's plan must
-- have room. The sync and the owner's action check first; this is the backstop.
CREATE OR REPLACE FUNCTION public.plan_covered_pages_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cap  int;
  v_used int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM listings l
    WHERE l.id = NEW.listing_id
      AND l.owner_user_id = NEW.owner_user_id
      AND l.deleted_at IS NULL
      AND plan_coverable(l.entity_type)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'That page can''t be put on this plan.';
  END IF;

  v_cap := owner_page_cap(NEW.owner_user_id);
  SELECT count(*) INTO v_used
  FROM plan_covered_pages
  WHERE owner_user_id = NEW.owner_user_id
    AND listing_id <> NEW.listing_id
    AND (TG_OP = 'INSERT' OR listing_id <> OLD.listing_id);

  IF v_used + 1 > v_cap THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Your plan already covers as many pages as it can.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_covered_pages_guard ON public.plan_covered_pages;
CREATE TRIGGER plan_covered_pages_guard
  BEFORE INSERT OR UPDATE ON public.plan_covered_pages
  FOR EACH ROW EXECUTE FUNCTION public.plan_covered_pages_guard();

ALTER TABLE public.plan_covered_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_covered_pages: owner read" ON public.plan_covered_pages;
CREATE POLICY "plan_covered_pages: owner read"
  ON public.plan_covered_pages FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- No INSERT, UPDATE or DELETE policy: the server writes through the functions.
REVOKE INSERT, UPDATE, DELETE ON public.plan_covered_pages FROM anon, authenticated;


-- ─── 4. sync_owner_plan_tiers ────────────────────────────────────────────────
--
-- p_fill:   also fill empty slots (a new plan, a plan change, a lapsed plan
--           coming back). Without it, empty slots are filled only when the
--           owner has no covered page at all, so an owner who removed a page
--           on purpose keeps it removed.
-- p_anchor: the page to cover first when filling (the checkout page).
--
-- Returns {tier, cap, covered: [ids oldest first], changes: [{id, from, to}]}
-- or {skipped: 'no_billing' | 'plan_unresolved'}.

CREATE OR REPLACE FUNCTION public.sync_owner_plan_tiers(
  p_owner  uuid,
  p_fill   boolean DEFAULT false,
  p_anchor uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier    text := 'free';
  v_cap     int  := 0;
  v_count   int;
  v_next    uuid;
  v_changes jsonb := '[]'::jsonb;
  v_covered jsonb;
  r         record;
BEGIN
  IF p_owner IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'sync_owner_plan_tiers: owner is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('owner_plan:' || p_owner::text, 0));

  IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = p_owner)
     AND NOT EXISTS (SELECT 1 FROM plan_covered_pages WHERE owner_user_id = p_owner) THEN
    RETURN jsonb_build_object('skipped', 'no_billing');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM subscriptions s
    LEFT JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = p_owner
      AND s.status IN ('active', 'trialing', 'past_due')
      AND plan_rank(p.plan_key) = 0
  ) THEN
    RETURN jsonb_build_object('skipped', 'plan_unresolved');
  END IF;

  SELECT p.plan_key INTO v_tier
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = p_owner
    AND s.status IN ('active', 'trialing', 'past_due')
  ORDER BY plan_rank(p.plan_key) DESC
  LIMIT 1;
  v_tier := coalesce(v_tier, 'free');
  v_cap  := owner_page_cap(p_owner);

  -- Rows that no longer hold: this owner's rows for pages that moved to
  -- someone else, were deleted or can't be covered, and other owners' leftover
  -- rows for pages this owner now holds.
  DELETE FROM plan_covered_pages c
  USING listings l
  WHERE l.id = c.listing_id
    AND (
      (c.owner_user_id = p_owner AND (
         l.owner_user_id IS DISTINCT FROM p_owner
         OR l.deleted_at IS NOT NULL
         OR NOT plan_coverable(l.entity_type)))
      OR (l.owner_user_id = p_owner AND c.owner_user_id <> p_owner)
    );

  IF v_tier <> 'free' THEN
    SELECT count(*) INTO v_count FROM plan_covered_pages WHERE owner_user_id = p_owner;

    IF p_fill OR v_count = 0 THEN
      WHILE v_count < v_cap LOOP
        SELECT l.id INTO v_next
        FROM listings l
        WHERE l.owner_user_id = p_owner
          AND l.deleted_at IS NULL
          AND plan_coverable(l.entity_type)
          AND NOT EXISTS (SELECT 1 FROM plan_covered_pages c WHERE c.listing_id = l.id)
        ORDER BY
          coalesce(l.id = p_anchor, false) DESC,
          (SELECT min(s.created_at) FROM subscriptions s
             WHERE s.listing_id = l.id AND s.user_id = p_owner
               AND s.status IN ('active', 'trialing', 'past_due')) ASC NULLS LAST,
          EXISTS (
            SELECT 1 FROM listing_location_links k
            JOIN plan_covered_pages c ON c.listing_id = k.primary_listing_id
            WHERE k.location_listing_id = l.id AND c.owner_user_id = p_owner
          ) DESC,
          (l.status = 'published') DESC,
          l.created_at ASC,
          l.id ASC
        LIMIT 1;

        EXIT WHEN v_next IS NULL;
        INSERT INTO plan_covered_pages (listing_id, owner_user_id) VALUES (v_next, p_owner);
        v_count := v_count + 1;
        v_next := NULL;
      END LOOP;
    END IF;

    -- Over the cap after a downgrade: keep the pages covered longest.
    DELETE FROM plan_covered_pages
    WHERE listing_id IN (
      SELECT listing_id FROM plan_covered_pages
      WHERE owner_user_id = p_owner
      ORDER BY added_at, listing_id
      OFFSET v_cap
    );
  END IF;

  FOR r IN
    SELECT l.id,
           l.tier AS from_tier,
           CASE WHEN v_tier <> 'free' AND c.listing_id IS NOT NULL THEN v_tier ELSE 'free' END AS to_tier
    FROM listings l
    LEFT JOIN plan_covered_pages c ON c.listing_id = l.id AND c.owner_user_id = p_owner
    WHERE l.owner_user_id = p_owner
      AND l.deleted_at IS NULL
      AND plan_coverable(l.entity_type)
    ORDER BY l.created_at, l.id
  LOOP
    IF r.from_tier IS DISTINCT FROM r.to_tier THEN
      UPDATE listings SET tier = r.to_tier WHERE id = r.id;
      v_changes := v_changes || jsonb_build_object('id', r.id, 'from', r.from_tier, 'to', r.to_tier);
    END IF;
  END LOOP;

  SELECT coalesce(jsonb_agg(listing_id ORDER BY added_at, listing_id), '[]'::jsonb) INTO v_covered
  FROM plan_covered_pages WHERE owner_user_id = p_owner;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'cap', v_cap,
    'covered', v_covered,
    'changes', v_changes
  );
END;
$$;


-- ─── 5. set_plan_page_coverage ───────────────────────────────────────────────
--
-- The owner's choice on /dashboard/upgrade. Removes, then adds, then syncs, in
-- one transaction, so "Move Plan Here" on a one-page plan is a single step.
-- Raises P0001 'NO_PLAN' when the owner has no live plan, and 23514 from the
-- guard when a page isn't theirs or the plan is full.

CREATE OR REPLACE FUNCTION public.set_plan_page_coverage(
  p_owner  uuid,
  p_add    uuid[] DEFAULT '{}',
  p_remove uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_owner IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'set_plan_page_coverage: owner is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('owner_plan:' || p_owner::text, 0));

  IF owner_page_cap(p_owner) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NO_PLAN';
  END IF;

  DELETE FROM plan_covered_pages
  WHERE owner_user_id = p_owner
    AND listing_id = ANY (coalesce(p_remove, '{}'));

  FOREACH v_id IN ARRAY coalesce(p_add, '{}') LOOP
    -- A leftover row from a previous owner of this page goes first.
    DELETE FROM plan_covered_pages c
    USING listings l
    WHERE c.listing_id = v_id AND l.id = v_id
      AND l.owner_user_id = p_owner AND c.owner_user_id <> p_owner;

    INSERT INTO plan_covered_pages (listing_id, owner_user_id)
    VALUES (v_id, p_owner)
    ON CONFLICT (listing_id) DO NOTHING;
  END LOOP;

  RETURN sync_owner_plan_tiers(p_owner, false, NULL);
END;
$$;


-- ─── 6. Who may call what ────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.sync_owner_plan_tiers(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_plan_page_coverage(uuid, uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_page_cap(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_owner_plan_tiers(uuid, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_plan_page_coverage(uuid, uuid[], uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_page_cap(uuid) TO service_role;


-- ─── 7. Backfill (idempotent) ────────────────────────────────────────────────
-- Each owner with a live subscription: cover the subscribed pages first, then
-- their linked locations, up to the plan's cap. Every tier change is printed.

DO $$
DECLARE
  r record;
  v jsonb;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id
    FROM subscriptions
    WHERE status IN ('active', 'trialing', 'past_due')
    ORDER BY user_id
  LOOP
    v := sync_owner_plan_tiers(r.user_id, true, NULL);
    IF v ? 'skipped' OR jsonb_array_length(v -> 'changes') > 0 THEN
      RAISE NOTICE 'owner plan backfill %: %', r.user_id, v;
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
