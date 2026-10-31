-- =============================================================================
-- Backfill 2026-11: self-listed live pages become Claimed (ticket 160)
-- =============================================================================
-- Ticket 158 made new approvals of owner-submitted, owner-attested pages go
-- live as Claimed. This moves the pages approved before it the same way:
--   1. listings.trust_tier unclaimed -> claimed
--   2. one approved claims row per page (claimant = owner, reviewed_at =
--      published_at so the 90-day Certified clock counts from go-live)
--   3. the owner user_roles row (kept if it already exists)
--   4. one admin_audit_log row per page with before/after
--
-- Not a migration. Run once per project as postgres or the service role (the
-- owner guard trigger lets both through). One statement, so it is atomic, and
-- re-running it is a no-op: it only selects pages that are still unclaimed.
--
-- Down plan (manual, not run here):
--   update listings set trust_tier = 'unclaimed'
--    where trust_tier = 'claimed'
--      and id in (select listing_id from claims where notes = 'Backfill 2026-11: owner-submitted page');
--   delete from claims where notes = 'Backfill 2026-11: owner-submitted page';
--   user_roles rows stay (ownership already lives in owner_user_id).

with targets as (
  select l.id, l.owner_user_id, l.published_at
  from listings l
  where l.source = 'owner'
    and l.ownership_attested
    and l.owner_user_id is not null
    and l.trust_tier = 'unclaimed'
    and l.status = 'published'
    and l.deleted_at is null
    and l.entity_type not in ('event', 'job')
  for update
),
moved as (
  update listings l
     set trust_tier = 'claimed'
    from targets t
   where l.id = t.id
  returning l.id
),
new_claims as (
  insert into claims (listing_id, claimant_user_id, status, role_at_business,
                      submitted_at, reviewed_at, reviewed_by, notes)
  select t.id, t.owner_user_id, 'approved', 'owner',
         t.published_at, t.published_at, null,
         'Backfill 2026-11: owner-submitted page'
  from targets t
  join moved m on m.id = t.id
  returning id, listing_id
),
roles as (
  insert into user_roles (user_id, role, listing_id, granted_by)
  select t.owner_user_id, 'owner', t.id, null
  from targets t
  join moved m on m.id = t.id
  on conflict (user_id, role, listing_id) do nothing
  returning id
),
audit as (
  insert into admin_audit_log (admin_user_id, action, target_table, target_id,
                               before_state, after_state)
  select null, 'backfill_self_listed_claimed', 'listings', c.listing_id,
         jsonb_build_object('trust_tier', 'unclaimed'),
         jsonb_build_object('trust_tier', 'claimed', 'claim_id', c.id,
                            'ticket', '160')
  from new_claims c
  returning id
)
select
  (select count(*) from moved)      as listings_moved,
  (select count(*) from new_claims) as claims_added,
  (select count(*) from roles)      as owner_roles_added,
  (select count(*) from audit)      as audit_rows;
