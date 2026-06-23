# MyListing Richness Initiative — Update Cards (Pillar A + B)

**Trello-paste-ready cards for everything we built after veering off the production roadmap into the MyListing-theme richness** (founder's "everything and more" vision). One place to see the whole detour.

_Created 2026-06-23 · Work completed 2026-06-22._

> **Read this first.** This is an **after-launch enhancement track**. None of it is on the **MVP critical path** — the launch is still gated by the founder/infra items (`founder-action-cards.md` F3–F10) and the production stand-up cards (`project-board.md` 091–094). Every feature here was built with the **fail-soft resilience pattern**: new tables/columns are read via separate queries, so pages render correctly **before** the migrations are applied. **Pillar A is verified on staging** (ticket 103). **Pillar B is built + verified** (tsc/lint clean, a11y green); its 4 migrations are pending a staging paste (see Founder card `Fn-B`).
>
> Companions: project board → [project-board.md](./project-board.md) · founder cards → [../launch/founder-action-cards.md](../launch/founder-action-cards.md) · faceted-filtering ticket → [103](../tickets/103-faceted-filtering-identity-facets.md).

---

## Label legend (reused from the main board)

- **Area color:** 🟦 Frontend/UX · 🟩 Backend/API/DB · 🟧 Content/Data · 🟨 QA · 🩷 Product.
- **Priority:** 🔴 P0 · 🟠 P1 · 🟡 P2.
- **Phase prefix:** `[v1.1]` / `[v1.2]` (the enhancement-track versions) — these sit on top of `[MVP]`.
- **Status:** ✅ Done · ⏳ pending (staging apply) · ⬜ deferred.

**Suggested Trello list:** "MyListing Enhancements (after-launch)" — keep it separate from the MVP launch lists so it never reads as a launch blocker.

---

# Project board cards (Done lane)

---

## `[v1.1] 🟠 P1` Pillar A — Faceted discovery & Identity facets — ✅ DONE, verified on staging
🟦 Frontend · 🟩 Backend/DB · ✅ complete (2026-06-22) · **Ticket:** [103](../tickets/103-faceted-filtering-identity-facets.md)

**Description.** The MyListing "rich filtering" layer for `/discover`: a real attributes taxonomy, a faceted search engine with disjunctive counts, and a faceted sidebar — with the flagship **Identity & Ownership** facet set (Black-Owned, Black-Woman/Man-Owned, LGBTQ+-Owned, Veteran-Owned, Immigrant-Owned, Family-Owned, Faith-Based, Minority-Certified) as the differentiator. Owners tag their listing's attributes; supporters filter by them; identity chips surface on cards. **Verified on staging** — migrations + attribute data applied, listings reconciled, 32/32 a11y green, filters live.

**Checklist.**
- ✅ Attributes taxonomy: `attribute_groups`, `attribute_values`, `listing_attributes`, `tags`, `listing_tags` + usage-count triggers + RLS + `is_open_now()` (migration `…0000`)
- ✅ Faceted search RPCs: `search_listings_faceted` (ordered ids + total; AND across groups / OR within) + `facet_counts` (disjunctive per-option counts), both `SECURITY DEFINER` (migration `…0001`)
- ✅ Attribute vocab seeded (6 groups incl. the full Identity & Ownership set) + backfill so counts are demonstrable
- ✅ Faceted sidebar: multi-select groups + live counts, sort dropdown, active-filter chips, mobile filter sheet, DB-driven categories (`components/discovery/*`)
- ✅ Owner attributes editor (`components/dashboard/AttributesSection.tsx` + `updateListingAttributes`) + listing display (`EntityAttributes`) + identity chips on `EntityCard`
- ✅ `/discover` resilience fix — identity chips fetched via a separate fail-soft `attachIdentityChips()` query (the embed was zeroing out results before the migration was applied)
- ✅ 32/32 a11y tests green; filters live on `/discover`

**Migrations.** `20260622000000_attributes_taxonomy.sql` ✅ staging · `20260622000001_search_listings_faceted_rpc.sql` ✅ staging · attribute seed/backfill (`staging-attributes-seed.sql`) ✅ staging.

---

## `[v1.2] 🟠 P1` Pillar B — Listing & owner richness (video · links · FAQ · menu grouping) — ✅ DONE
🟦 Frontend · 🟩 Backend/DB · ✅ complete (2026-06-22)

**Description.** Four owner-controlled content blocks that bring a BLACQList Page closer to a MyListing-grade listing: an embedded video, a flexible set of action links, an FAQ accordion, and grouped menu/offerings. Each renders fail-soft (hidden until the owner adds content).

**Checklist.**
- ✅ **B1 — Video:** `listing_details_business.video_embed_url`; host-whitelisted YouTube/Vimeo `<iframe>` (`EntityVideoSection`) + owner editor (`VideoSection`). _Migration `…0002` ✅ applied._
- ✅ **B3 — Flexible links:** `LinksSection` editor + `add/deleteListingLink` actions + `EntityLinks` render (booking/menu/order/website/socials, icons by type). **No migration** (`listing_links` already existed). Seed fixed: `platform`→`link_type`, socials skipped (already in `social_*`).
- ✅ **B4 — FAQ:** `listing_faqs` table + `FaqSection` editor + add/delete actions + accessible native `<details>` accordion (`EntityFaqSection`). _Migration `…0004` ⏳ pending._
- ✅ **B5 — Menu/offerings grouping:** `services.group_label`; grouped offerings render with subheadings (`EntityOfferingsSection`) + editor inputs. _Migration `…0003` ✅ applied._

---

## `[v1.2] 🟠 P1` Pillar B — Reviews upgrade (multi-criteria ratings + moderated photos) — ✅ DONE
🟦 Frontend · 🟩 Backend · 🟨 QA · ✅ complete (2026-06-22)

**Description.** Extends the existing review system (which was already live + admin-moderated) with MyListing-style depth: optional per-category star ratings and reviewer-submitted photos — both riding the existing review-publish moderation gate so nothing un-moderated goes public.

**Checklist.**
- ✅ **B2a — Multi-criteria ratings:** `review_criteria` (seeded Quality/Service/Value/Atmosphere) + `review_ratings`. Overall `reviews.rating` + its avg trigger **unchanged**; per-criterion rows are optional, written best-effort in `createReview`. ReviewForm shows optional rows; `EntityReviewsSection` shows a category-average strip + per-review breakdown chips. _Migration `…0005` ⏳ pending._
- ✅ **B2b — Moderated review photos:** reviewer uploads up to 3 photos (jpeg/png/webp ≤5 MB) via the service client (mirrors the receipt-upload flow — reviewers aren't owners) to `listing-media/reviews/<id>/…`, stored `is_approved=false`. **Photos auto-approve when the admin publishes the review** (`moderateReview`); admin sees pending thumbnails on `/admin/reviews/[id]`; public thumbnails on the listing. _Migration `…0006` (read policies) ⏳ pending._

---

## `[v1.2] 🟠 P1` Pillar B — Events as a first-class entity — ✅ DONE
🟦 Frontend · 🟩 Backend/DB · ✅ complete (2026-06-22)

**Description.** Events become real listings with their own pages and discovery (the founder chose the full entity over a lightweight on-page block). Create → admin review → published event page → discoverable → surfaced on the organizer's business page. Reuses the listings status/slug/save/moderation infrastructure wholesale.

**Checklist.**
- ✅ **Schema:** re-added `event` to `listings_entity_type_check`; new 1:1 `listing_details_event` table (mirrors `listing_details_business` RLS) + `organizer_listing_id` + `starts_at`/`ends_at`. _Migration `…0007` ⏳ pending._
- ✅ **Create:** dedicated `app/add-event` + `SubmitEventForm` (the 7-step business wizard left untouched) → `createListingAction` branches to insert event details → lands the owner on the dashboard editor (same draft→pending→published lifecycle as businesses).
- ✅ **Event page:** branch in the entity route → `EntityEventDetails` (When/Where · ticket CTA · organizer link · about) + **Event JSON-LD**; business-only sections hidden.
- ✅ **Dashboard editor:** `EventDetailsSection` (date/venue/online/ticket/organizer-picker) + `updateEventDetails`; business-only sections suppressed for events.
- ✅ **Discovery + tie-in:** the `/discover` **Events** type filter already worked; business pages show an **"Upcoming events"** section (published events where `organizer_listing_id = businessId`, `starts_at ≥ now`).

**Deferred (V1 events pass):** ticketing/payments, RSVP/attendee management, recurring/multi-session events, event reviews, event auto-expiry/archive, and a dedicated `/events` index (needs a `'soonest'` sort → an RPC migration).

---

## `[v1.2] 🟡 P2` Pillar B — Event polish (card dates + add-to-calendar) — ✅ DONE
🟦 Frontend · ✅ complete (2026-06-22) · **No migration**

**Description.** Two small finishing touches so events feel complete everywhere they appear. Both use the fail-soft attach pattern — no new SQL.

**Checklist.**
- ✅ **Event date on discovery cards:** `attachEventStartDates` (mirrors `attachIdentityChips`, **no faceted-RPC change**) attaches `starts_at` to event results in `queryListings` + the related-cards list; `EntityCard` renders a dated line for events. Covers `/discover` + related-discovery.
- ✅ **Add-to-calendar (`.ics`):** dependency-free `lib/calendar/ics.ts` builder + `app/api/events/[listingId]/calendar` route (proper `text/calendar` headers, mobile-safe, published-only) + an "Add to calendar" button on the event page.

---

# V1 cards pulled forward

This initiative shipped large chunks of two planned V1 cards early. Annotate them on the main board:

---

## `[V1] 🟠 P1` Reviews system — ⏩ substantially pulled forward
🟦 Frontend · 🟩 Backend · **Due ~Aug 22, 2026**

- ✅ Star + text review submission (live) **+ B2a multi-criteria ratings + B2b moderated photos**
- ✅ Moderation queue (`/admin/reviews` + `moderateReview`); **photo approval rides review publish**
- ✅ Public display with average rating **+ per-criterion breakdown chips + category-average strip + photo thumbnails**
- ⬜ **Still open:** the **auto-certification signal wiring** (review-count/tenure → Certified tier). The review UX itself is done.

---

## `[V1] 🟡 P2` Additional Page templates — ⏩ Event template DONE
🟦 Frontend · **Due ~Sep 5, 2026**

- ✅ **Event template — DONE (Pillar B B6):** full first-class `event` entity (the heaviest of the four templates).
- ⬜ **Still open:** Professional, Creative, and Job templates, plus an optional event auto-expiry/archive job.

---

# Founder card

---

## `🙋🏾‍♀️ Fn-B · 🟡` Paste the 4 Pillar B migrations on staging — NON-BLOCKING (after-launch)
🟩 Backend/DB · 🟡 nice-to-have · ⏳ founder-gated (Supabase SQL editor) · **Unblocks:** the Pillar B features on staging (FAQ · multi-criteria reviews + photos · events)

**Description.** Pillar B is built and verified, but four migrations haven't been applied to **staging** yet. They're idempotent and self-contained (table + RLS + seed each), and the pages render fail-soft before they're applied — so this is a safe, do-it-anytime step that switches the new features on. **This is NOT a launch blocker** and is not part of F1–F10. **Done when** all four run with no errors and you can smoke-test the flows below.

**Checklist.**
- Paste `supabase/migrations/20260622000004_listing_faqs.sql` (FAQ accordion)
- Paste `supabase/migrations/20260622000005_review_criteria.sql` (multi-criteria review ratings + seed)
- Paste `supabase/migrations/20260622000006_review_media_rls.sql` (review-photo read policies)
- Paste `supabase/migrations/20260622000007_event_entity.sql` (events as a first-class entity)
- Smoke-test: add an FAQ on a listing · submit a review with a photo → publish it in `/admin/reviews/[id]` → photo shows · create an event at `/add-event` → publish → it renders at `/{city}/event/{slug}`, appears under the **Events** discover filter, and (if you set an organizer) under "Upcoming events" on that business's page

**Notes.**
- **Pillar A's migrations are already on staging** (`…0000`, `…0001`, + attribute seed) — no action there.
- **Production:** none of this initiative is on the production migration set yet. When you decide to take these features live (after the MVP launch), **all** of the initiative's migrations — Pillar A's two + the six Pillar B ones — get applied to production as part of that release, not the launch deploy.

**Links.** plan: `~/.claude/plans/my-original-theme-for-tranquil-flask.md` · migrations: `supabase/migrations/2026062200000{4,5,6,7}_*.sql` · founder cards: [../launch/founder-action-cards.md](../launch/founder-action-cards.md)

---

# Migration reference — the whole initiative

| Migration / seed | Slice | Enables | Staging |
|---|---|---|---|
| `20260622000000_attributes_taxonomy.sql` | Pillar A | Attribute groups/values, listing_attributes, tags, `is_open_now()`, RLS | ✅ applied |
| `20260622000001_search_listings_faceted_rpc.sql` | Pillar A | `search_listings_faceted` + `facet_counts` (faceted search + disjunctive counts) | ✅ applied |
| attribute seed/backfill (`staging-attributes-seed.sql`) | Pillar A | Identity & Ownership vocab + demonstrable counts | ✅ applied |
| `20260622000002_listing_video.sql` | B1 | `video_embed_url` (embedded video) | ✅ applied |
| `20260622000003_services_group_label.sql` | B5 | `services.group_label` (menu grouping) | ✅ applied |
| `20260622000004_listing_faqs.sql` | B4 | `listing_faqs` table + RLS (FAQ accordion) | ⏳ pending |
| `20260622000005_review_criteria.sql` | B2a | `review_criteria` + `review_ratings` + seed (multi-criteria) | ⏳ pending |
| `20260622000006_review_media_rls.sql` | B2b | `media_attachments` review-photo read policies | ⏳ pending |
| `20260622000007_event_entity.sql` | B6 | `event` entity type + `listing_details_event` table + RLS | ⏳ pending |
| _(none)_ | B3 | Flexible links (`listing_links` already existed) | — |
| _(none)_ | Event polish | Card dates + `.ics` (fail-soft attach + a route handler) | — |

**Apply order:** migrations are timestamp-ordered; paste the pending four in ascending order (`…0004` → `…0007`). All are idempotent — re-running is safe.
