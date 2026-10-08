# Ticket 131: Creator listing type, category and filters

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none
**Gates:** GATE-DATA. A new migration (`2026101xxxxxxx_creator_entity.sql`) widens the `listings.entity_type` CHECK, adds a category, three filter groups, a column and an RPC parameter. Additive only. Apply on staging, then prod, each with a founder OK, before merge. Prod runs through a founder script, then an anon read-back.
**Decision record:** `docs/blacqlist/features/creators-and-influencers.md`

---

## Why

`[Decision — founder, 2026-10-08]` Creators should be "easy to find as a group", with "niche as a filter under creators". Today every creator-like listing is an agency filed as `business`, and filter groups can only be scoped by listing type. A separate `creator` type is the only way to give creators their own chip, address and filters without touching `creative`.

## Scope

In:

- `creator` listing type, end to end in the type plumbing.
- Parent category "Creators & Influencers" with five subcategories.
- Three creator-only filter groups: niche, platforms, audience size.
- `listings.open_to_partnerships` column (used by tickets 132 and 134).
- `p_open_to_partnerships` parameter on `search_listings_faceted` (used by ticket 134).
- A "Creators" Discover chip and template routing.
- Search words that send creator searches to the new subcategories.

Out:

- The sign-up path (132), socials (133), filter UI and badges (134), home page (135).
- Moving any existing agency listing. "Influencer Marketing" stays for agencies.

## How it works

**Migration**, header carries a rollback note (drop the column and parameter, delete the new groups and categories, narrow the CHECK, only while no `creator` rows exist):

| Change | Detail |
|---|---|
| Type CHECK | Add `'creator'` to the list last set in `20260813000000_job_entity.sql` |
| Category | `creators-influencers` parent; children `influencers`, `video-creators`, `podcasters`, `streamers`, `writers-newsletters`. Inserted by parent slug, `ON CONFLICT (slug) DO NOTHING`, same pattern as `20261007010000_farms_grocery_banks_categories.sql` |
| `creator-niche` | checkbox, `applies_to '{creator}'`, 16 values (see spec) |
| `creator-platforms` | checkbox, `applies_to '{creator}'`, 9 values |
| `audience-size` | radio, `applies_to '{creator}'`, label "Audience size (self-reported)", 5 values |
| Column | `open_to_partnerships boolean NOT NULL DEFAULT false`, partial index `WHERE open_to_partnerships` |
| RPC | `p_open_to_partnerships boolean DEFAULT NULL` on `search_listings_faceted`; NULL means no filter. Recreated from the latest definition (`20260924000000_type_shortcuts_relevance.sql`) with every other behavior unchanged |

`supabase/seed.sql` mirrors the categories and groups.

**Code:**

| Need | Where |
|---|---|
| Type list + label | `lib/constants/listing.ts` (`VALID_ENTITY_TYPES`) |
| Search params | `lib/validations/search.ts` |
| Discover chip | `components/discovery/facetConstants.ts` |
| Chip → category | `lib/listings/type-shortcuts.ts`: `creator` → `creators-influencers`, not part of `creative` |
| Featured buckets | `lib/featured/buckets.ts` |
| Card + banner | `components/discovery/EntityCard.tsx`, `components/discovery/DiscoverBanner.tsx` |
| Page template | `EntityTemplateOutlet.tsx`: `creator` → `CreativeTemplate` with a creator hero variant |
| Search words | `lib/categories/sorting-guide.ts`: influencer, creator, podcast, tiktok, youtuber → new subcategories |

The owner entitlement guard is a denylist, so owners can write `open_to_partnerships` with no trigger change. Owners still can't change `entity_type`.

## Acceptance criteria

- Given the migration has run, then a listing can be saved with `entity_type = 'creator'`, and every existing type still saves.
- Given `/discover?type=creator`, then only the three creator filter groups show alongside the shared ones, and creator listings in any Creators subcategory appear.
- Given `/discover?type=creative`, then no creator listings and no creator filter groups appear.
- Given a creator page with a city, then its address is `/<city>/creator/<slug>`. Without a city, `/online/creator/<slug>`.
- Given a creator page, then it renders with the creative template and its creator hero.
- Given a search for "podcast" or "tiktok", then the category guide suggests the new subcategories, and "influencer marketing agency" still suggests Influencer Marketing.
- Given the RPC is called without `p_open_to_partnerships`, then results match what they were before the migration.
- Given the migration has not run yet, then pages, Discover and the editor still load.

## Known limits

- Niche and platform words aren't in full-text search yet. The filters cover them.
- No creator listings exist until ticket 132 ships.

## QA notes

- Unit: update `tests/type-shortcuts.test.ts` (creator block, `rollupCells` types) and `tests/sorting-guide.test.ts` (slugs checked against seed.sql).
- Migration: `tests/migrations/creator-entity.test.ts`, mirroring `tests/migrations/job-entity.test.ts` (CHECK, categories, groups, column default, RPC with and without the partners filter). Needs Docker.
- Static: `pnpm typecheck` catches a missed type branch in the outlet switch.
- Prod read-back as anon (`SET LOCAL ROLE anon`): new category and groups visible, column present, no listing changed.
