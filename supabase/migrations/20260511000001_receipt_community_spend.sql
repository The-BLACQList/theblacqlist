-- ──────────────────────────────────────────────────────────────────────────────
-- Receipt Upload & Community Spend Beta
-- Tables: receipt_uploads, spend_events, flow_nodes, flow_edges
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── receipt_uploads ─────────────────────────────────────────────────────────

CREATE TABLE receipt_uploads (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id              uuid REFERENCES listings(id) ON DELETE SET NULL,
  raw_business_name       text,
  file_path               text,
  amount_cents            integer NOT NULL,
  purchase_date           date NOT NULL,
  notes                   text,
  status                  text NOT NULL DEFAULT 'pending_review'
                            CHECK (status IN ('pending_review', 'approved', 'rejected')),
  client_idempotency_key  text NOT NULL UNIQUE,
  rejection_reason        text,
  aggregate_opt_out       boolean NOT NULL DEFAULT false,
  source                  text NOT NULL DEFAULT 'web',
  reviewed_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX receipt_uploads_user_id_idx ON receipt_uploads (user_id);
CREATE INDEX receipt_uploads_listing_id_idx ON receipt_uploads (listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX receipt_uploads_status_idx ON receipt_uploads (status);
CREATE INDEX receipt_uploads_purchase_date_idx ON receipt_uploads (purchase_date);

CREATE TRIGGER set_receipt_uploads_updated_at
  BEFORE UPDATE ON receipt_uploads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── spend_events ─────────────────────────────────────────────────────────────
-- No user_id by design — anonymized community spend data.

CREATE TABLE spend_events (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_upload_id   uuid REFERENCES receipt_uploads(id) ON DELETE SET NULL,
  listing_id          uuid REFERENCES listings(id) ON DELETE SET NULL,
  city_id             uuid REFERENCES cities(id) ON DELETE SET NULL,
  amount_cents        integer NOT NULL,
  purchase_date       date NOT NULL,
  source              text NOT NULL DEFAULT 'receipt_upload',
  aggregate_opt_out   boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX spend_events_listing_id_idx ON spend_events (listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX spend_events_city_id_idx ON spend_events (city_id) WHERE city_id IS NOT NULL;
CREATE INDEX spend_events_purchase_date_idx ON spend_events (purchase_date);
CREATE INDEX spend_events_aggregate_idx ON spend_events (aggregate_opt_out, purchase_date)
  WHERE aggregate_opt_out = false;

-- ─── flow_nodes ───────────────────────────────────────────────────────────────

CREATE TABLE flow_nodes (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  node_type             text NOT NULL CHECK (node_type IN ('business', 'city')),
  entity_id             uuid NOT NULL,
  total_amount_cents    bigint NOT NULL DEFAULT 0,
  transaction_count     integer NOT NULL DEFAULT 0,
  last_transaction_at   timestamptz,
  UNIQUE (node_type, entity_id)
);

CREATE INDEX flow_nodes_entity_id_idx ON flow_nodes (entity_id);

-- ─── flow_edges ───────────────────────────────────────────────────────────────

CREATE TABLE flow_edges (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_node_id        uuid NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node_id        uuid NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  total_amount_cents    bigint NOT NULL DEFAULT 0,
  transaction_count     integer NOT NULL DEFAULT 0,
  UNIQUE (source_node_id, target_node_id)
);

CREATE INDEX flow_edges_source_idx ON flow_edges (source_node_id);
CREATE INDEX flow_edges_target_idx ON flow_edges (target_node_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE receipt_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE spend_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_edges      ENABLE ROW LEVEL SECURITY;

-- receipt_uploads: owner reads/writes own rows; no anon access
CREATE POLICY "receipt_uploads_owner_select"
  ON receipt_uploads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "receipt_uploads_owner_insert"
  ON receipt_uploads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- spend_events: public read (no PII); mutations service role only
CREATE POLICY "spend_events_public_select"
  ON spend_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- flow_nodes: public read; mutations service role only
CREATE POLICY "flow_nodes_public_select"
  ON flow_nodes FOR SELECT
  TO anon, authenticated
  USING (true);

-- flow_edges: public read; mutations service role only
CREATE POLICY "flow_edges_public_select"
  ON flow_edges FOR SELECT
  TO anon, authenticated
  USING (true);
