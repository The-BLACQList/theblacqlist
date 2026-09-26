// =============================================================================
// Migration test: 20260926000000_listings_entitlement_guard.sql
// =============================================================================
// The audit finding this migration closes: any listing owner holding their own
// session token could PATCH their row straight through PostgREST and set
// `tier = 'premium'`, `trust_tier = 'certified'`, `status = 'published'`. RLS
// checked the owner, never the columns.
//
// So these tests do what the attacker would do: connect AS `authenticated` with
// a real JWT subject and send the write. Asserting that a trigger exists in
// pg_trigger would prove nothing about what it lets through.
//
// Three groups, and all three matter:
//
//   * ATTACKS must fail — and the row must be unchanged afterwards.
//   * LEGITIMATE OWNER FLOWS must still pass. A guard that blocks the owner
//     dashboard is an outage, not a fix. Each case mirrors a real server action
//     (named inline).
//   * SYSTEM WRITERS must still pass: service_role (admin, webhook, sweeps) and
//     SECURITY DEFINER triggers (save/review counters). The second is the one a
//     careless `auth.role()` check would have broken.
//
// The first test runs the headline attack WITHOUT the migration and expects it
// to SUCCEED. That keeps every "fails" assertion below honest: if the fixture's
// grants or policies ever stop reproducing the hole, that test goes red instead
// of the whole suite passing for the wrong reason.
//
// The fixture mirrors the real listings columns, defaults and CHECKs that the
// guard reads, and the original policies from 20260510000001 and
// 20260511000002, so the migration's DROP ... IF EXISTS replaces real text.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases — the harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from "vitest"
import path from "node:path"
import { DB_REACHABLE, MIGRATIONS_DIR, applyFile, exec, query, raises, withScratchDb } from "./helpers"

const MIGRATION = path.join(MIGRATIONS_DIR, "20260926000000_listings_entitlement_guard.sql")

const OWNER = "11111111-1111-1111-1111-111111111111"
const OTHER = "22222222-2222-2222-2222-222222222222"
const CATEGORY = "99999999-9999-9999-9999-999999999999"

// Seeded listings, all owned by OWNER unless noted.
const L = {
  draftUnclaimed: "a0000000-0000-0000-0000-000000000001",
  draftClaimed: "a0000000-0000-0000-0000-000000000002",
  published: "a0000000-0000-0000-0000-000000000003",
  pending: "a0000000-0000-0000-0000-000000000004",
  jobDraft: "a0000000-0000-0000-0000-000000000005",
  growth: "a0000000-0000-0000-0000-000000000006",
  others: "a0000000-0000-0000-0000-000000000007", // owned by OTHER
} as const

const FIXTURE = `
  CREATE SCHEMA IF NOT EXISTS auth;

  CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE TABLE listings (
    id                            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name                          text NOT NULL,
    slug                          text NOT NULL,
    entity_type                   text NOT NULL CHECK (entity_type IN ('business','restaurant','service_provider','professional','creative','vendor','event','job')),
    tagline                       text,
    category_id                   uuid NOT NULL,
    status                        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','unpublished','flagged','archived','rejected')),
    tier                          text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','starter','growth','premium')),
    source                        text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner','community','admin','import')),
    published_at                  timestamptz,
    trust_tier                    text NOT NULL DEFAULT 'unclaimed' CHECK (trust_tier IN ('unclaimed','claimed','verified','certified')),
    claim_id                      uuid,
    verified_at                   timestamptz,
    verified_by                   uuid,
    certification_auto_granted_at timestamptz,
    flag_status                   text NOT NULL DEFAULT 'none' CHECK (flag_status IN ('none','inactive','duplicate','incorrect','spam')),
    admin_notes                   text,
    moderation_notes              text,
    is_featured                   boolean NOT NULL DEFAULT false,
    is_sponsored                  boolean NOT NULL DEFAULT false,
    sponsored_expires_at          timestamptz,
    sponsored_placement_type      text CHECK (sponsored_placement_type IN ('homepage','search','category','city')),
    verification_status           text NOT NULL DEFAULT 'none' CHECK (verification_status IN ('none','pending','under_review','verified','rejected')),
    verification_docs             text[],
    verification_notes            text,
    meta_title                    text,
    last_edited_by_owner_at       timestamptz,
    last_admin_updated_at         timestamptz,
    auto_archive_at               timestamptz,
    auto_expire_at                timestamptz,
    stale_flagged_at              timestamptz,
    review_count                  integer NOT NULL DEFAULT 0,
    avg_rating                    numeric(3,2),
    save_count                    integer NOT NULL DEFAULT 0,
    view_count                    integer NOT NULL DEFAULT 0,
    owner_user_id                 uuid,
    submitted_by                  uuid,
    updated_by                    uuid,
    created_at                    timestamptz NOT NULL DEFAULT now(),
    updated_at                    timestamptz NOT NULL DEFAULT now(),
    deleted_at                    timestamptz,
    ownership_label               text NOT NULL DEFAULT 'black_owned' CHECK (ownership_label IN ('black_owned','ally')),
    activity_score                numeric NOT NULL DEFAULT 0
  );

  -- A later-sorting BEFORE trigger that rewrites NEW, like the real
  -- set_updated_at. The guard must sort ahead of it and not trip on it.
  CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "listings: read" ON listings FOR SELECT TO anon, authenticated
    USING (status = 'published' OR owner_user_id = auth.uid());

  -- Verbatim from 20260510000001_mvp_rls_policies.sql.
  CREATE POLICY "listings: authenticated insert"
    ON listings FOR INSERT TO authenticated
    WITH CHECK (
      submitted_by = auth.uid()
      AND owner_user_id = auth.uid()
    );

  CREATE POLICY "listings: owner update"
    ON listings FOR UPDATE TO authenticated
    USING (owner_user_id = auth.uid())
    WITH CHECK (owner_user_id = auth.uid());

  CREATE TABLE claims (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id        uuid NOT NULL REFERENCES listings(id),
    claimant_user_id  uuid,
    status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected','withdrawn')),
    submitted_at      timestamptz DEFAULT now(),
    reviewed_at       timestamptz,
    reviewed_by       uuid,
    rejection_reason  text,
    notes             text
  );
  ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "claims: authenticated insert"
    ON claims FOR INSERT TO authenticated
    WITH CHECK (claimant_user_id = auth.uid());

  CREATE TABLE marketplace_products (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id  uuid NOT NULL REFERENCES listings(id),
    name        text NOT NULL,
    global_slug text NOT NULL,
    status      text NOT NULL DEFAULT 'draft',
    created_by  uuid
  );
  CREATE TABLE marketplace_services (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id  uuid NOT NULL REFERENCES listings(id),
    name        text NOT NULL,
    global_slug text NOT NULL,
    status      text NOT NULL DEFAULT 'draft',
    created_by  uuid
  );
  ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
  ALTER TABLE marketplace_services ENABLE ROW LEVEL SECURITY;

  -- Verbatim from 20260511000002_marketplace_foundation.sql.
  CREATE POLICY "marketplace_products_insert"
    ON marketplace_products FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = listing_id
          AND listings.owner_user_id = auth.uid()
          AND listings.deleted_at IS NULL
      )
    );
  CREATE POLICY "marketplace_services_insert"
    ON marketplace_services FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM listings
        WHERE listings.id = listing_id
          AND listings.owner_user_id = auth.uid()
          AND listings.deleted_at IS NULL
      )
    );

  -- Stand-in for the real save-count trigger (20260630000000): SECURITY
  -- DEFINER, so it runs as its owner even when a signed-in user saves.
  CREATE TABLE saves (
    user_id    uuid NOT NULL,
    listing_id uuid NOT NULL REFERENCES listings(id),
    PRIMARY KEY (user_id, listing_id)
  );
  ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "saves: own insert" ON saves FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

  CREATE OR REPLACE FUNCTION update_listing_save_count()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    UPDATE listings SET save_count = save_count + 1 WHERE id = NEW.listing_id;
    RETURN NEW;
  END; $$;
  CREATE TRIGGER saves_count AFTER INSERT ON saves
    FOR EACH ROW EXECUTE FUNCTION update_listing_save_count();

  INSERT INTO listings (id, name, slug, entity_type, category_id, status, trust_tier, tier, published_at, owner_user_id, submitted_by) VALUES
    ('${L.draftUnclaimed}', 'Draft Unclaimed', 'draft-unclaimed', 'business', '${CATEGORY}', 'draft',     'unclaimed', 'free',   NULL,  '${OWNER}', '${OWNER}'),
    ('${L.draftClaimed}',   'Draft Claimed',   'draft-claimed',   'business', '${CATEGORY}', 'draft',     'claimed',   'free',   NULL,  '${OWNER}', '${OWNER}'),
    ('${L.published}',      'Published',       'published',       'business', '${CATEGORY}', 'published', 'claimed',   'free',   now(), '${OWNER}', '${OWNER}'),
    ('${L.pending}',        'Pending',         'pending',         'business', '${CATEGORY}', 'pending',   'unclaimed', 'free',   NULL,  '${OWNER}', '${OWNER}'),
    ('${L.jobDraft}',       'Job Draft',       'job-draft',       'job',      '${CATEGORY}', 'draft',     'claimed',   'free',   NULL,  '${OWNER}', '${OWNER}'),
    ('${L.growth}',         'Growth',          'growth',          'business', '${CATEGORY}', 'published', 'claimed',   'growth', now(), '${OWNER}', '${OWNER}'),
    ('${L.others}',         'Someone Else',    'someone-else',    'business', '${CATEGORY}', 'published', 'claimed',   'free',   now(), '${OTHER}', '${OTHER}');

  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

  -- Deliberately generous. Table grants are never what stops a request in
  -- these tests, so every denial below is the guard or RLS doing its job.
  GRANT SELECT, INSERT, UPDATE, DELETE
    ON listings, claims, marketplace_products, marketplace_services, saves
    TO authenticated, service_role;
  GRANT SELECT ON listings TO anon;
`

type Role = "anon" | "authenticated" | "service_role"

function preamble(role: Role, uid: string | null): string {
  return `SELECT set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
          SET ROLE ${role};`
}

// `exec` opens a fresh connection per call, so SET ROLE and the statement
// travel together in one `-c`.
function runsAs(url: string, role: Role, uid: string | null, sql: string): boolean {
  return !raises(url, `${preamble(role, uid)} ${sql}`)
}

function failsAs(url: string, role: Role, uid: string | null, sql: string): boolean {
  return raises(url, `${preamble(role, uid)} ${sql}`)
}

// Capture the guard's error text, to prove a failure came from the guard and
// not from something incidental (a CHECK, a typo in the test SQL).
function errorAs(url: string, role: Role, uid: string | null, sql: string): string {
  try {
    exec(url, `${preamble(role, uid)} ${sql}`)
    return ""
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e)
  }
}

function row(url: string, id: string): Record<string, unknown> {
  const [r] = query<Record<string, unknown>>(url, `SELECT * FROM listings WHERE id = '${id}'`)
  if (!r) throw new Error(`listing ${id} missing`)
  // updated_at moves on any successful write; everything else must not.
  delete r.updated_at
  return r
}

async function withMigrated(name: string, fn: (url: string) => void | Promise<void>): Promise<void> {
  await withScratchDb(name, async (url) => {
    exec(url, FIXTURE)
    applyFile(url, MIGRATION)
    await fn(url)
  })
}

const insertListing = (cols: string, vals: string): string =>
  `INSERT INTO listings (name, slug, entity_type, category_id, owner_user_id, submitted_by${cols ? `, ${cols}` : ""})
     VALUES ('New', 'new-${Math.random().toString(36).slice(2, 8)}', 'business', '${CATEGORY}', '${OWNER}', '${OWNER}'${vals ? `, ${vals}` : ""});`

describe.skipIf(!DB_REACHABLE)("migration: listings entitlement guard", () => {
  it("reproduces the hole without the migration (keeps the attack cases honest)", async () => {
    await withScratchDb("entitlement_guard_baseline", (url) => {
      exec(url, FIXTURE)
      expect(
        runsAs(url, "authenticated", OWNER,
          `UPDATE listings SET tier = 'premium', is_featured = true, trust_tier = 'certified' WHERE id = '${L.published}';`),
      ).toBe(true)
      expect(row(url, L.published).tier).toBe("premium")
    })
  })

  it("installs one guard trigger that sorts ahead of every other BEFORE trigger", async () => {
    await withMigrated("entitlement_guard_shape", (url) => {
      const triggers = query<{ tgname: string }>(
        url,
        `SELECT tgname FROM pg_trigger
          WHERE tgrelid = 'listings'::regclass AND NOT tgisinternal
          ORDER BY tgname`,
      )
      expect(triggers.map((t) => t.tgname)).toEqual(["a0_listings_owner_guard", "set_updated_at"])

      const [fn] = query<{ prosecdef: boolean }>(
        url,
        "SELECT prosecdef FROM pg_proc WHERE proname = 'listings_owner_guard'",
      )
      // SECURITY INVOKER: current_user inside the guard is the caller's role.
      expect(fn?.prosecdef).toBe(false)
    })
  })

  it("blocks an owner from writing any platform-owned column, and leaves the row untouched", async () => {
    await withMigrated("entitlement_guard_columns", (url) => {
      const before = row(url, L.published)

      const attacks = [
        "tier = 'premium'",
        "tier = 'starter'",
        "is_featured = true",
        "is_sponsored = true",
        "sponsored_placement_type = 'homepage'",
        "sponsored_expires_at = now() + interval '1 year'",
        "trust_tier = 'certified'",
        "trust_tier = 'verified'",
        "verified_at = now()",
        `verified_by = '${OWNER}'`,
        "certification_auto_granted_at = now()",
        `claim_id = '${OTHER}'`,
        "review_count = 99",
        "avg_rating = 5.0",
        "save_count = 1000",
        "view_count = 1000",
        "activity_score = 1000",
        "published_at = now() - interval '5 years'",
        "deleted_at = now()",
        "auto_expire_at = now() + interval '10 years'",
        "auto_archive_at = now()",
        "stale_flagged_at = now()",
        "flag_status = 'spam'",
        "source = 'admin'",
        "entity_type = 'restaurant'",
        `submitted_by = '${OTHER}'`,
        "admin_notes = 'approved by admin'",
        "moderation_notes = 'ok'",
        "last_admin_updated_at = now()",
        "verification_notes = 'looks good'",
      ]

      for (const set of attacks) {
        const err = errorAs(url, "authenticated", OWNER, `UPDATE listings SET ${set} WHERE id = '${L.published}';`)
        expect(err, set).toContain("This field can only be changed by The BLACQList.")
      }

      // The full headline payload from the audit, in one request.
      expect(
        failsAs(url, "authenticated", OWNER,
          `UPDATE listings SET tier = 'premium', is_featured = true, trust_tier = 'certified', status = 'published'
            WHERE id = '${L.draftUnclaimed}';`),
      ).toBe(true)

      expect(row(url, L.published)).toEqual(before)
    })
  })

  it("allows only the owner dashboard's status moves", async () => {
    await withMigrated("entitlement_guard_status", (url) => {
      const blocked: Array<[string, string]> = [
        [L.pending, "published"],        // skip moderation
        [L.draftUnclaimed, "published"], // self-publish before any claim
        [L.jobDraft, "pending"],         // job skips the paid-posting check
        [L.jobDraft, "published"],
        [L.draftClaimed, "archived"],
        [L.published, "pending"],
        [L.pending, "draft"],
        [L.published, "unpublished"],
      ]
      for (const [id, to] of blocked) {
        const err = errorAs(url, "authenticated", OWNER, `UPDATE listings SET status = '${to}' WHERE id = '${id}';`)
        expect(err, `${id} → ${to}`).toContain("That status change needs The BLACQList to review it.")
      }

      // submitForReview.ts: draft → pending.
      expect(runsAs(url, "authenticated", OWNER, `UPDATE listings SET status = 'pending' WHERE id = '${L.draftUnclaimed}';`)).toBe(true)
      // updateListingStatus.ts unpublish: published → draft.
      expect(runsAs(url, "authenticated", OWNER, `UPDATE listings SET status = 'draft' WHERE id = '${L.published}';`)).toBe(true)
      // updateListingStatus.ts publish: claimed draft → published.
      expect(runsAs(url, "authenticated", OWNER, `UPDATE listings SET status = 'published' WHERE id = '${L.draftClaimed}';`)).toBe(true)

      expect(row(url, L.draftUnclaimed).status).toBe("pending")
      expect(row(url, L.published).status).toBe("draft")
      expect(row(url, L.draftClaimed).status).toBe("published")
      expect(row(url, L.jobDraft).status).toBe("draft")
      expect(row(url, L.pending).status).toBe("pending")
    })
  })

  it("lets an owner request verification but never grant it", async () => {
    await withMigrated("entitlement_guard_verification", (url) => {
      expect(failsAs(url, "authenticated", OWNER, `UPDATE listings SET verification_status = 'verified' WHERE id = '${L.published}';`)).toBe(true)
      expect(failsAs(url, "authenticated", OWNER, `UPDATE listings SET verification_status = 'under_review' WHERE id = '${L.published}';`)).toBe(true)

      // submitVerificationRequest.ts: none → pending, with the uploaded doc paths.
      expect(
        runsAs(url, "authenticated", OWNER,
          `UPDATE listings SET verification_status = 'pending', verification_docs = ARRAY['a/b.pdf'] WHERE id = '${L.published}';`),
      ).toBe(true)
      // …and pending → verified is still refused.
      expect(failsAs(url, "authenticated", OWNER, `UPDATE listings SET verification_status = 'verified' WHERE id = '${L.published}';`)).toBe(true)

      // A rejected request may be re-submitted.
      exec(url, `UPDATE listings SET verification_status = 'rejected' WHERE id = '${L.growth}';`)
      expect(runsAs(url, "authenticated", OWNER, `UPDATE listings SET verification_status = 'pending' WHERE id = '${L.growth}';`)).toBe(true)
    })
  })

  it("still lets an owner edit their content", async () => {
    await withMigrated("entitlement_guard_content", (url) => {
      // updateListingContent.ts / applySuggestion.ts shape.
      expect(
        runsAs(url, "authenticated", OWNER,
          `UPDATE listings SET tagline = 'Fresh bread daily', meta_title = 'Bakery', ownership_label = 'ally',
                  last_edited_by_owner_at = now(), updated_by = '${OWNER}'
            WHERE id = '${L.published}';`),
      ).toBe(true)
      const r = row(url, L.published)
      expect(r.tagline).toBe("Fresh bread daily")
      expect(r.status).toBe("published")

      // Re-sending unchanged protected values (a full-row PATCH) is not a change.
      expect(
        runsAs(url, "authenticated", OWNER,
          `UPDATE listings SET tier = 'growth', trust_tier = 'claimed', status = 'published', tagline = 'x'
            WHERE id = '${L.growth}';`),
      ).toBe(true)
    })
  })

  it("forces a new listing to start as a free, unclaimed draft", async () => {
    await withMigrated("entitlement_guard_insert", (url) => {
      const blocked: Array<[string, string]> = [
        ["tier", "'premium'"],
        ["trust_tier", "'certified'"],
        ["is_featured", "true"],
        ["is_sponsored", "true"],
        ["verification_status", "'verified'"],
        ["source", "'admin'"],
        ["published_at", "now()"],
        ["review_count", "50"],
        ["avg_rating", "5.0"],
        ["save_count", "10"],
        ["activity_score", "10"],
        ["admin_notes", "'ok'"],
      ]
      for (const [col, val] of blocked) {
        expect(failsAs(url, "authenticated", OWNER, insertListing(col, val)), `${col} = ${val}`).toBe(true)
      }

      const badStatus = errorAs(url, "authenticated", OWNER, insertListing("status", "'published'"))
      expect(badStatus).toContain("A new listing must start as a draft.")
      expect(failsAs(url, "authenticated", OWNER, insertListing("status", "'archived'"))).toBe(true)
      // A job must go through the server's paid-posting check.
      expect(
        failsAs(url, "authenticated", OWNER,
          `INSERT INTO listings (name, slug, entity_type, category_id, owner_user_id, submitted_by, status)
             VALUES ('Job', 'job-new', 'job', '${CATEGORY}', '${OWNER}', '${OWNER}', 'pending');`),
      ).toBe(true)

      // createListing.ts: a draft with the defaults.
      expect(runsAs(url, "authenticated", OWNER, insertListing("status, source, tier, trust_tier", "'draft', 'owner', 'free', 'unclaimed'"))).toBe(true)
      // submitListing.ts shape: a non-job straight to pending.
      expect(runsAs(url, "authenticated", OWNER, insertListing("status", "'pending'"))).toBe(true)
      // A job draft is fine; only its status move is gated.
      expect(
        runsAs(url, "authenticated", OWNER,
          `INSERT INTO listings (name, slug, entity_type, category_id, owner_user_id, submitted_by)
             VALUES ('Job', 'job-draft-new', 'job', '${CATEGORY}', '${OWNER}', '${OWNER}');`),
      ).toBe(true)

      expect(query(url, "SELECT id FROM listings WHERE tier <> 'free' AND slug LIKE 'new-%'")).toHaveLength(0)
    })
  })

  it("only lets a claim be born pending and unreviewed", async () => {
    await withMigrated("entitlement_guard_claims", (url) => {
      const claim = (extra: string, vals: string): string =>
        `INSERT INTO claims (listing_id, claimant_user_id${extra}) VALUES ('${L.others}', '${OWNER}'${vals});`

      expect(failsAs(url, "authenticated", OWNER, claim(", status", ", 'approved'"))).toBe(true)
      expect(failsAs(url, "authenticated", OWNER, claim(", status", ", 'under_review'"))).toBe(true)
      // Backdated review date — the 90-day certification clock reads it.
      expect(failsAs(url, "authenticated", OWNER, claim(", reviewed_at", ", now() - interval '1 year'"))).toBe(true)
      expect(failsAs(url, "authenticated", OWNER, claim(", reviewed_by", `, '${OWNER}'`))).toBe(true)
      expect(failsAs(url, "authenticated", OWNER, claim(", rejection_reason", ", 'x'"))).toBe(true)
      // Someone else's name on the claim.
      expect(
        failsAs(url, "authenticated", OWNER,
          `INSERT INTO claims (listing_id, claimant_user_id) VALUES ('${L.others}', '${OTHER}');`),
      ).toBe(true)

      // createClaim.ts: pending, with the claimant's own note.
      expect(runsAs(url, "authenticated", OWNER, claim(", status, notes", ", 'pending', 'I own this shop'"))).toBe(true)
      expect(query(url, "SELECT id FROM claims")).toHaveLength(1)
    })
  })

  it("only lets a Growth or Premium listing open a storefront", async () => {
    await withMigrated("entitlement_guard_marketplace", (url) => {
      for (const table of ["marketplace_products", "marketplace_services"]) {
        const ins = (listing: string, slug: string): string =>
          `INSERT INTO ${table} (listing_id, name, global_slug, created_by) VALUES ('${listing}', 'Item', '${slug}', '${OWNER}');`

        expect(failsAs(url, "authenticated", OWNER, ins(L.published, `${table}-free`)), `${table} on free`).toBe(true)
        expect(failsAs(url, "authenticated", OWNER, ins(L.others, `${table}-other`)), `${table} on another's`).toBe(true)
        expect(runsAs(url, "authenticated", OWNER, ins(L.growth, `${table}-growth`)), `${table} on growth`).toBe(true)
      }

      // Premium passes too, once the platform (not the owner) sets it.
      exec(url, `UPDATE listings SET tier = 'premium' WHERE id = '${L.published}';`)
      expect(
        runsAs(url, "authenticated", OWNER,
          `INSERT INTO marketplace_products (listing_id, name, global_slug, created_by) VALUES ('${L.published}', 'Item', 'premium-ok', '${OWNER}');`),
      ).toBe(true)
    })
  })

  it("does not touch system writers: service_role, the table owner, and SECURITY DEFINER triggers", async () => {
    await withMigrated("entitlement_guard_system", (url) => {
      // Admin actions, the Stripe webhook and the sweeps use the service client.
      expect(
        runsAs(url, "service_role", null,
          `UPDATE listings SET tier = 'premium', trust_tier = 'verified', status = 'published',
                  published_at = now(), verified_at = now(), admin_notes = 'ok'
            WHERE id = '${L.pending}';`),
      ).toBe(true)
      expect(runsAs(url, "service_role", null, `UPDATE listings SET status = 'pending' WHERE id = '${L.jobDraft}';`)).toBe(true)
      expect(runsAs(url, "service_role", null, `UPDATE listings SET deleted_at = now() WHERE id = '${L.draftUnclaimed}';`)).toBe(true)
      expect(row(url, L.pending).tier).toBe("premium")
      expect(row(url, L.jobDraft).status).toBe("pending")

      // Migrations and cron run as the owner role.
      expect(() => exec(url, `UPDATE listings SET activity_score = 42 WHERE id = '${L.growth}';`)).not.toThrow()

      // A signed-in user saving someone else's listing: the save_count bump runs
      // inside a SECURITY DEFINER trigger. An auth.role() check would reject it.
      expect(runsAs(url, "authenticated", OWNER, `INSERT INTO saves (user_id, listing_id) VALUES ('${OWNER}', '${L.others}');`)).toBe(true)
      expect(row(url, L.others).save_count).toBe(1)
    })
  })

  it("does not let an owner touch someone else's listing", async () => {
    await withMigrated("entitlement_guard_others", (url) => {
      const before = row(url, L.others)
      // RLS hides it from UPDATE, so this silently affects zero rows.
      runsAs(url, "authenticated", OWNER, `UPDATE listings SET tagline = 'Hijacked' WHERE id = '${L.others}';`)
      expect(row(url, L.others)).toEqual(before)
      // Handing your own listing to someone else is refused too.
      expect(failsAs(url, "authenticated", OWNER, `UPDATE listings SET owner_user_id = '${OTHER}' WHERE id = '${L.published}';`)).toBe(true)
    })
  })

  it("is safe to apply twice", async () => {
    await withMigrated("entitlement_guard_rerun", (url) => {
      expect(() => applyFile(url, MIGRATION)).not.toThrow()

      const triggers = query(url, "SELECT tgname FROM pg_trigger WHERE tgname = 'a0_listings_owner_guard'")
      expect(triggers).toHaveLength(1)

      const policies = query<{ tablename: string; policyname: string }>(
        url,
        `SELECT tablename, policyname FROM pg_policies
          WHERE tablename IN ('claims', 'marketplace_products', 'marketplace_services') AND cmd = 'INSERT'
          ORDER BY tablename`,
      )
      expect(policies).toHaveLength(3)

      expect(failsAs(url, "authenticated", OWNER, `UPDATE listings SET tier = 'premium' WHERE id = '${L.published}';`)).toBe(true)
      expect(runsAs(url, "authenticated", OWNER, `UPDATE listings SET tagline = 'still fine' WHERE id = '${L.published}';`)).toBe(true)
    })
  })
})
