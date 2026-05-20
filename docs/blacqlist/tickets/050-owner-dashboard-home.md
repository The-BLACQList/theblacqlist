# Ticket 050: Owner dashboard home — stats overview, claim status, completion checklist (/dashboard)

---

## Status
Backlog

## Phase
Phase 8: Owner Dashboard

## Priority
P1 — High

## Estimate
L (4–8h)

## Feature Area
Owner Dashboard

---

## Context

The dashboard home at `/dashboard` is the first screen an owner sees after signing in or being approved for their claim. It serves three distinct purposes: (1) telling the owner the current status of their listing (published, draft, or claim pending), (2) showing them 7-day performance stats, and (3) guiding them to complete their listing profile via a checklist.

The dashboard has three distinct entry states based on the owner's situation: a new owner with no listing yet (shows a "Create your page" empty state), an owner with a draft listing (shows the completion checklist prominently), and an owner with a published listing (shows stats + checklist if incomplete). These states require careful role-based rendering.

Analytics data (7-day stats) comes from the `GET /api/dashboard` Route Handler which aggregates from `entity_analytics_daily`. At MVP, detailed analytics are a placeholder — only the 7-day summary is shown. The platform's `analytics_events` populate `entity_analytics_daily` via a nightly aggregation job (or on-demand query); this ticket reads the already-aggregated data.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Dashboard Home; `docs/blacqlist/architecture/api-contract.md` § 27 (Get Dashboard Overview); `docs/blacqlist/ux/empty-loading-error-success-states.md` § 11.1.

---

## User Story

As a business owner, I want to see how my listing is performing at a glance and know exactly what I still need to complete, so that I can take action on my listing without hunting through menus.

---

## Scope

**In scope:**
- `app/dashboard/page.tsx` — Server Component; authenticated Owner-only; fetches data from `GET /api/dashboard`
- Role-based redirect: if the authenticated user has no owner role for any listing → redirect to `/account` (supporters don't have a `/dashboard` in MVP)
- **Three dashboard states:**
  1. **No listing:** User has owner role but no listing associated — show "Create your BLACQList Page" empty state with two CTAs: "Search for my business to claim" → `/claim` and "Create a new page" → `/add-business`
  2. **Draft listing:** Has listing but `status = 'draft'` or `'pending'` — show completion checklist prominently, stat cards show `—` with "Stats begin once your page is published"
  3. **Published listing:** Full dashboard — stats + checklist (if incomplete) + quick actions
- **Claim status banner** (rendered on all states that have a listing): contextual by claim status — Amber Gold banner if `claim.status = 'pending'` or `'under_review'`; no banner if approved or no claim
- **Page preview card:** Cover image thumbnail, business name, city + category, "View live page →" link (opens new tab), publish status badge (Published / Draft)
- **Stats row:** 4 metric cards — Page views (7d), CTA clicks (7d), Saves (7d), Shares (7d); data from `analytics_7d` in API response; at MVP the cards show the 7-day numbers with a note: "Detailed analytics coming soon" below the row (not on each card)
- **Quick actions bar:** Three buttons — "Edit My Page" → `/dashboard/page`, "Preview Page" (opens BLACQList Page in new tab), "Share Page" (calls `ShareButton` logic or opens copy-link modal)
- **Completion checklist:** "Complete your page" section; progress bar (`N of 5 complete`); 5 checkable items; each unchecked item links to the relevant section of the page editor:
  1. Add your description — checks `listing_details_business.description IS NOT NULL AND description != ''`
  2. Upload a cover image — checks `listings.cover_image_path IS NOT NULL`
  3. Set your primary CTA — checks `listing_details_business.cta_type IS NOT NULL`
  4. Add your hours — checks `listing_hours` table has at least one row for this listing, OR `listing_details_business.hours IS NOT NULL`
  5. Add at least one service — checks `services` count > 0 for this listing
  - Checklist is hidden entirely once all 5 items are complete AND the page has been published for 7+ days
- Loading state: stat card skeletons + page preview card skeleton + quick action button stubs
- Error state (analytics fetch failure): stat cards show `—` with a small "Couldn't load" label + "Retry" text link; rest of dashboard renders normally

**Out of scope:**
- Page Editor (`/dashboard/page`) — separate ticket
- Services Manager (`/dashboard/services`) — separate ticket
- Detailed analytics views (V1)
- Multi-listing support (owners with more than one listing — at MVP only one listing per owner is assumed)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 013 — Auth middleware (owner role check) | Blocking ticket | Not started |
| Ticket 014 — Account sidebar layout (Dashboard sidebar variant) | Blocking ticket | Not started |
| Ticket 049 — Analytics event ingestion API | Blocking ticket | `entity_analytics_daily` must have data |
| Ticket 009 — `entity_analytics_daily` table and aggregation | Blocking ticket | Not started |
| `GET /api/dashboard` Route Handler | API | Not started (created in this ticket) |
| `ShareButton` component | Component | Must exist from Ticket 047 |

---

## UX Notes

- **Screen:** Dashboard Home — `docs/blacqlist/ux/mvp-screen-map.md` § Dashboard Home
- **Route:** `/dashboard`
- **Layout:** Dashboard sidebar — fixed left sidebar (desktop), bottom nav bar (mobile); main content area scrollable
- **Entry points:** Post-login redirect for owners; sidebar nav "Overview" link; post-claim approval email link
- **Exit points:** Edit My Page → `/dashboard/page`; Preview Page → new tab; Share Page → in-place modal/copy; Create listing CTAs → `/claim` or `/add-business`

**Sidebar nav items (from screen map):** Overview (active), My Page, Services, Settings

**Three states detail (from `empty-loading-error-success-states.md` § 11.1):**

| State | Claim status banner | Stats | Checklist | Page preview |
|---|---|---|---|---|
| No listing | Hidden | Hidden | Hidden | Hidden; show "Create your page" empty state instead |
| Draft / Pending | Amber Gold banner if claim pending | `—` with "Stats begin once your page is published" | Prominent (expanded, not collapsed) | Show listing name + status badge (Draft / Pending) |
| Published | Hidden (if approved) or banner (if claim still under review) | 7-day stats | Show if incomplete; hidden if 5/5 complete for 7+ days | Show with "View live page →" |

**Loading state (from § 11.1):**
- Skeleton: status banner area + 4 stat card skeletons + page preview card skeleton + quick action button stubs
- Each stat card skeleton: two lines — metric value (large) + label (small)

**Error state (analytics only):**
- Stat cards show `—` with a small "Couldn't load" label + "Retry" text link per card
- The page preview card, quick actions, and completion checklist still render

**Mobile behavior:**
- Dashboard sidebar collapses to a bottom nav bar: Overview, My Page, Services, Settings tabs
- Stat cards: 1×4 column stack on mobile (full-width each)
- Quick actions: stacked vertically, full-width buttons
- Completion checklist: collapsible accordion on mobile

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Card`, `CardHeader`, `CardContent`, `CardDescription`, `CardTitle`, `Button`, `Badge`, `Progress`, `Skeleton`, `Separator`
- **Stat cards:**
  ```
  ┌──────────────────────┐
  │ Page Views            │
  │ [COUNT in Glacial     │
  │  Indifference Bold    │
  │  large numerals]      │
  │ Last 7 days           │
  └──────────────────────┘
  ```
  Grid: `grid grid-cols-2 lg:grid-cols-4 gap-4` (2 columns on mobile, 4 on desktop)
- **Claim status banner:** Full-width, `bg-[#E2A428]` (Amber Gold), Brand Black text, `px-4 py-3`, positioned above the page preview card
- **Completion checklist progress bar:** shadcn/ui `Progress` component; Amber Gold fill; label: "N of 5 complete"
- **Checklist items:** Each is a row: checkmark icon (green if complete, outline if not) + label + link if incomplete (text link in Amber Gold)
- **Empty state (no listing):** Centered in the main area; "Create your BLACQList Page" as `h2`; body: "Let's get you found."; two buttons stacked: primary Amber Gold + ghost
- **States to implement:** Loading (skeletons), No listing (empty), Draft (checklist prominent), Published (stats + checklist), Analytics error (partial)

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `listings`, `listing_details_business`, `listing_claims`, `listing_hours`, `listing_services`, `entity_analytics_daily`
- **Entities involved:** All of the above, joined in `GET /api/dashboard`
- **Operations:** GET only — no mutations on this page
- **Key data from `GET /api/dashboard` response (per api-contract.md § 27):**
  ```typescript
  listings[0].analytics_7d: {
    page_views: number,
    cta_clicks: number,
    saves: number,
    shares: number
  }
  listings[0].claim.status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | null
  listings[0].status: 'draft' | 'pending' | 'published' | ...
  listings[0].cover_image_path: string | null
  listings[0].published_at: string | null
  ```
- **Completion checklist data:** The checklist items require additional detail fields not in the base `listings` response. The `GET /api/dashboard` Route Handler should JOIN `listing_details_business` to include `description`, `cta_type` and `listing_hours` count, and `listing_services` count to compute the checklist in the API response. Return a `completion_status` object:
  ```typescript
  completion_status: {
    has_description: boolean,
    has_cover_image: boolean,
    has_cta: boolean,
    has_hours: boolean,
    has_services: boolean
  }
  ```
- **Analytics aggregation:** `entity_analytics_daily` contains pre-aggregated daily rows per listing; the Route Handler sums the last 7 days: `WHERE listing_id = $id AND snapshot_date >= now() - interval '7 days'`
- **RLS policies:** `listings` scoped to `owner_user_id = auth.uid()`; `entity_analytics_daily` scoped by ownership; use authenticated Supabase client (not service_role)
- **Migration required:** No — all tables from prior tickets

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` § 27

**Route Handler to create in this ticket:** `app/api/dashboard/route.ts` (GET)

**Request:** No parameters; identity from session cookie

**Response:**

```typescript
interface DashboardOverviewResponse {
  data: {
    listings: Array<{
      id: string
      name: string
      slug: string
      entity_type: string
      status: 'draft' | 'pending' | 'published' | 'unpublished' | 'flagged' | 'archived'
      trust_tier: string
      listing_tier: string
      logo_path: string | null
      cover_image_path: string | null
      published_at: string | null
      claim: {
        status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
        submitted_at: string
      } | null
      analytics_7d: {
        page_views: number
        cta_clicks: number
        saves: number
        shares: number
      }
      completion_status: {
        has_description: boolean
        has_cover_image: boolean
        has_cta: boolean
        has_hours: boolean
        has_services: boolean
      }
    }>
  }
}
```

**Auth required:** Yes — Owner (any authenticated user; empty `listings` array for supporters)

**Error codes:**

| Code | HTTP | UI behavior |
|---|---|---|
| `AUTH_REQUIRED` | 401 | Middleware redirects to `/sign-in?next=/dashboard` |
| `FORBIDDEN` | 403 | Redirect to `/account` (supporter with no listings) |

**Analytics event emitted:** `dashboard_viewed` — properties: `{ listing_count: number }` — fire-and-forget from the page component

---

## Implementation Notes

**Files to create:**
- `app/dashboard/page.tsx` — Server Component; fetches `/api/dashboard`; branches on listing state; renders appropriate sections
- `app/api/dashboard/route.ts` — Route Handler; GET; authenticated; JOINs listings + details + claims + analytics + completion data
- `components/dashboard/StatCard.tsx` — individual metric card with label, count, and skeleton variant
- `components/dashboard/StatCardSkeleton.tsx` — skeleton version of `StatCard`
- `components/dashboard/ClaimStatusBanner.tsx` — Amber Gold banner; renders only when claim status is `pending` or `under_review`
- `components/dashboard/PagePreviewCard.tsx` — listing thumbnail, name, city/category, status badge, "View live page" link
- `components/dashboard/QuickActionsBar.tsx` — three action buttons
- `components/dashboard/CompletionChecklist.tsx` — progress bar + 5 checklist items; each item links to the relevant editor section
- `components/dashboard/DashboardEmptyState.tsx` — "Create your BLACQList Page" empty state for owners with no listing

**Files to modify:**
- Dashboard sidebar nav component — "Overview" item active on `/dashboard`

**Key patterns:**
- Server Component data fetching: fetch `/api/dashboard` from the page component using `fetch` with `{ cache: 'no-store' }` (dashboard is fully dynamic)
- Role check: if the API returns an empty `listings` array (supporter with no listings), render `DashboardEmptyState`; if `listings[0].status` is `'draft'`, render the draft state
- Stat cards load in parallel with a `<Suspense>` boundary wrapping `StatRow`; if the analytics data is `null` or all zeros and `published_at` is within the last day, show the "Stats begin once your page is published" note
- Completion checklist: `has_all = completion_status.has_description && completion_status.has_cover_image && completion_status.has_cta && completion_status.has_hours && completion_status.has_services`; checklist section is hidden when `has_all && listing was published 7+ days ago` (compare `published_at` to `now() - 7 days`)
- Fire `dashboard_viewed` analytics event as a fire-and-forget fetch (from a `useEffect` in a minimal "use client" wrapper or from a `<DashboardAnalyticsEvent>` Client Component)

**Do not:**
- Show the dashboard to authenticated supporters — redirect to `/account`
- Make the stats row block the rest of the dashboard from rendering — use `<Suspense>` so the stat cards can stream in
- Hardcode the checklist item names — derive them from `completion_status` object returned by the API

---

## Acceptance Criteria

- [ ] Given an authenticated owner with a published listing navigates to `/dashboard`, then the page renders: claim status banner (if applicable), page preview card, stat cards with 7-day data, quick actions bar, and completion checklist (if not all complete)
- [ ] Given an authenticated owner with no listing navigates to `/dashboard`, then the "Create your BLACQList Page" empty state renders with "Search for my business to claim" and "Create a new page" CTAs
- [ ] Given an authenticated owner with a draft listing, then stat cards show `—` with "Stats begin once your page is published"; the completion checklist is shown prominently
- [ ] Given an owner's claim is `status = 'pending'` or `'under_review'`, then the Amber Gold claim status banner renders: "Your claim is pending review. We'll email you at [email] within 48 hours."
- [ ] Given an owner's claim is approved, then no claim status banner is shown
- [ ] Stat card shows the correct 7-day sum of `page_views`, `cta_clicks`, `saves`, and `shares` from `entity_analytics_daily`
- [ ] Given the analytics fetch fails, then stat cards show `—` with a "Couldn't load" label and "Retry" link per card; the rest of the dashboard renders normally
- [ ] Completion checklist progress bar shows the correct fraction (e.g., "3 of 5 complete"); each incomplete item is a link to the relevant editor section
- [ ] Given all 5 checklist items are complete AND `published_at` was more than 7 days ago, then the completion checklist section is hidden entirely
- [ ] Loading state: 4 stat card skeletons + page preview skeleton + quick action stubs render during the initial fetch
- [ ] "View live page →" link opens the public BLACQList Page in a new tab
- [ ] "Edit My Page" navigates to `/dashboard/page`
- [ ] Mobile at 375px: stat cards stack 2×2 (then 1×4); sidebar collapses to bottom nav; quick actions stack vertically
- [ ] A `dashboard_viewed` analytics event is fired fire-and-forget on page load
- [ ] Authenticated supporters (non-owner) are redirected to `/account`

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Dashboard API fails | `/api/dashboard` returns 500 | Error boundary or inline: "Couldn't load your dashboard." + "Try again" button | Retry re-fetches |
| Analytics data missing | No rows in `entity_analytics_daily` for this listing | Stat cards show `—` with note | No action needed; data will appear once the aggregation runs |
| Analytics fetch partial failure | Some stat cards fail to load | Each failing stat card shows `—` + "Couldn't load" + "Retry" per card | Retry per card |
| Owner has no listing | `listings[]` is empty | "Create your BLACQList Page" empty state | CTAs guide to `/claim` or `/add-business` |
| Session expired | 401 from `/api/dashboard` | Middleware redirect to `/sign-in?next=/dashboard` | Re-authenticate |
| Supporter accesses `/dashboard` | No owner role | Redirect to `/account` (silent, no error message) | N/A |

---

## Edge Cases

- Owner with a listing that is `status = 'archived'` — show the page preview card with an "Archived" badge; stat cards show `—`; completion checklist not shown; an inline note: "Your page has been archived. Contact support to restore it."
- Owner's listing was approved by admin without a claim (e.g., admin manually set `owner_user_id`) — no claim record exists; `listing.claim = null`; no claim banner; normal dashboard renders
- `published_at` was exactly 7 days ago — checklist is hidden when `published_at < now() - 7 days`; use strict less-than comparison
- User completes the last checklist item in the page editor and returns to the dashboard — checklist is still shown until all 5 are complete AND 7 days have passed; "re-check" happens on the next API call (no real-time update needed)
- Listing cover image path is set but the Supabase Storage file has been deleted — image renders broken; the checklist still considers `has_cover_image = true` because the path is non-null

---

## Accessibility Notes

- [ ] Page `h1` is "Dashboard" or the business name — the first heading on the page
- [ ] Stat cards have accessible labels: `aria-label="Page views: [N] in the last 7 days"` (not just the number)
- [ ] Completion checklist: each item uses `<li>` within a `<ul>`; the progress bar has `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="5"`, `aria-label="Page completion: N of 5 items complete"`
- [ ] Quick action buttons have descriptive labels; "Preview Page" uses `target="_blank"` with a visually hidden "(opens in new tab)" annotation
- [ ] Loading skeleton containers: `aria-busy="true"` while fetching
- [ ] Claim status banner: `role="banner"` or `role="alert"` to ensure it is announced by screen readers on first render
- [ ] Empty state CTAs are keyboard-reachable with descriptive link text

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Happy path: published listing | 1. Log in as owner with a published listing that has 7d analytics data. 2. Navigate to `/dashboard`. | Stat cards show correct 7-day counts. Page preview card shows listing. Checklist shows correct completion. Quick actions render. |
| QA-2 | No listing empty state | 1. Log in as owner with no listing. 2. Navigate to `/dashboard`. | "Create your BLACQList Page" empty state renders with two CTA buttons. No stat cards or checklist. |
| QA-3 | Draft listing state | 1. Log in as owner with a draft listing. 2. Navigate to `/dashboard`. | Stat cards show `—` with "Stats begin once your page is published". Checklist shown prominently. |
| QA-4 | Claim pending banner | 1. Log in as owner with a pending claim. 2. Navigate to `/dashboard`. | Amber Gold claim status banner renders above the page preview card. |
| QA-5 | Analytics error | 1. Force the analytics data to fail (e.g., temporarily block the query). 2. Navigate to `/dashboard`. | Each stat card shows `—` with "Couldn't load" and a "Retry" link. Page preview, quick actions, and checklist still render. |
| QA-6 | Supporter access | 1. Log in as a supporter (no owner role). 2. Navigate to `/dashboard`. | Redirected to `/account`. Dashboard page is not rendered. |
| QA-7 | Mobile at 375px | 1. Open `/dashboard` on a 375px device. 2. Scroll and interact. | Stat cards stack 2×2. Quick actions stack vertically. Bottom nav shows "Overview" as active. Completion checklist is usable. |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] `GET /api/dashboard` Route Handler tested: returns listings + analytics_7d + completion_status + claim data
- [ ] Three dashboard states tested: no listing, draft, published
- [ ] Claim status banner: shown for pending/under_review; hidden for approved/no claim
- [ ] Stat cards: display correct 7-day sums; show `—` when data unavailable or listing is draft
- [ ] Analytics error state: stat cards degrade gracefully; rest of dashboard unaffected
- [ ] Completion checklist: correct boolean for each of 5 items; hidden when all complete + 7+ days published
- [ ] Completion checklist items link to correct editor sections
- [ ] "View live page →" opens in new tab
- [ ] `dashboard_viewed` analytics event fires fire-and-forget
- [ ] Supporter redirect to `/account` tested
- [ ] Mobile tested at 375px — stat card grid, bottom nav, stacked quick actions
- [ ] Loading skeleton tested — all three sections show skeletons before data resolves
- [ ] Accessibility: stat card aria-labels, progress bar aria attributes, banner role
