-- ──────────────────────────────────────────────────────────────────────────────
-- Close anon/authenticated direct read on the community-spend aggregate tables
--
-- 20260511000001 gave spend_events, flow_nodes and flow_edges a `USING (true)`
-- SELECT policy for anon + authenticated, with the comment "public read (no
-- PII)". Two things are wrong with that:
--
--   1. NOTHING READS THESE TABLES WITH THE ANON KEY. Every one of the six read
--      paths uses createServiceClient(), which bypasses RLS entirely:
--        app/page.tsx:83                        spend_events
--        app/(public)/flow-map/page.tsx:35,48,83  spend_events, flow_nodes x2
--        app/api/community-spend/route.ts:21,37,65
--        app/api/flow-map/summary/route.ts:20,38,67,90
--        app/account/community-spend/page.tsx:54,65,93
--      The policies grant a read path the product does not use. Dropping them
--      removes attack surface and changes no rendered page.
--
--   2. THE POLICY CONTRADICTS A PROMISE THE PRODUCT PUBLISHES. /flow-map says,
--      in the "Privacy by design" panel:
--
--        "All dollar-flow data is anonymized. Individual receipt details and
--         buyer identities are never included in public views. A named business
--         or city only appears here once 5 or more distinct transactions are
--         behind its total. ... Users can opt out of community aggregates at any
--         time."
--
--      That promise is enforced only in application queries — the
--      AGGREGATE_MIN_TRANSACTIONS bound (lib/spend/aggregate-privacy.ts) and the
--      `.eq('aggregate_opt_out', false)` filter. RLS enforced neither. With the
--      anon key, which ships in every browser bundle and is public by design, a
--      client could:
--        * SELECT every row of flow_nodes with no threshold at all, naming a
--          business next to its exact dollar total at transaction_count = 1 —
--          the precise disclosure the threshold exists to prevent;
--        * SELECT every row of spend_events INCLUDING rows where
--          aggregate_opt_out = true, so a user who opted out was still readable;
--        * group spend_events by listing_id to rebuild the same per-business
--          totals the threshold withholds, and read purchase_date + amount_cents
--          per transaction, which is a receipt in all but name.
--
--      No PII column is involved. The re-identification is in the combination:
--      one business, one date, one amount.
--
-- Service-role reads are unaffected — the service role bypasses RLS, so every
-- app surface behaves identically after this migration. RLS stays ENABLED on all
-- three tables; with no SELECT policy, anon and authenticated get zero rows,
-- which is the correct default for a table whose only legitimate reader is the
-- server.
--
-- Down plan: re-create the three policies exactly as 20260511000001 wrote them.
-- The statements are reproduced verbatim at the bottom of this file.
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "spend_events_public_select" ON spend_events;
DROP POLICY IF EXISTS "flow_nodes_public_select"   ON flow_nodes;
DROP POLICY IF EXISTS "flow_edges_public_select"   ON flow_edges;

-- RLS remains enabled on all three (set by 20260511000001:90-92). Restated here
-- as a no-op so the end state is readable in one file rather than two.
ALTER TABLE spend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_edges   ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────────
-- DOWN / ROLLBACK — verbatim from 20260511000001_receipt_community_spend.sql:105-121
--
-- -- spend_events: public read (no PII); mutations service role only
-- CREATE POLICY "spend_events_public_select"
--   ON spend_events FOR SELECT
--   TO anon, authenticated
--   USING (true);
--
-- -- flow_nodes: public read; mutations service role only
-- CREATE POLICY "flow_nodes_public_select"
--   ON flow_nodes FOR SELECT
--   TO anon, authenticated
--   USING (true);
--
-- -- flow_edges: public read; mutations service role only
-- CREATE POLICY "flow_edges_public_select"
--   ON flow_edges FOR SELECT
--   TO anon, authenticated
--   USING (true);
-- ──────────────────────────────────────────────────────────────────────────────
