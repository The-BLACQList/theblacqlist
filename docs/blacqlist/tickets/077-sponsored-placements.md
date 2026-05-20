# Ticket 077: Sponsored placements system — featured_slots table and admin management (/admin/sponsorships)

---

## Status
Draft

## Phase
Phase 14: Monetization and Sponsorship Foundation

## Priority
P3 — Low

## Estimate
M (2–4h)

## Feature Area
Monetization / Admin

---

## Context

The BLACQList generates revenue through sponsored listing placements — featured slots on city pages, category pages, and the homepage that give paying businesses elevated visibility. At MVP, placement sales are handled manually (off-platform) by the BLACQList team, who then configure the slots in the admin interface. There is no self-serve for vendors.

This ticket implements: (1) the `featured_slots` database table, (2) the admin management interface at `/admin/sponsorships`, and (3) the public-facing logic that reads active slots and renders "Sponsored" badges on relevant listing cards.

The "Sponsored" badge appears on listing cards on city pages, city-category pages, and the homepage whenever a listing has an active featured slot for that context (matching `slot_type` and `city_slug` / `category_slug`). No changes to listing cards themselves are required in this ticket — the badge is added to the existing card components.

Sources: `docs/blacqlist/data/database-schema-plan.md` § Sponsorships; `docs/blacqlist/architecture/api-contract.md` § Admin.

---

## User Story

As a platform admin, I want to create and manage featured listing slots, so that sponsored businesses appear prominently on the pages they paid to be featured on.

---

## Scope

**In scope:**
- Migration: `featured_slots` table with all fields defined below
- `app/admin/sponsorships/page.tsx` — Server Component; admin-only; renders active and upcoming slots
- Admin sponsorships table columns: Listing name, Slot type, City (if applicable), Category (if applicable), Start date, End date, Active status, Actions
- Filters: slot type (`all` / `homepage` / `city` / `category`), active only toggle
- `lib/actions/admin/createFeaturedSlot.ts` — Server Action; admin-only; INSERT `featured_slots`; writes `admin_audit_log`; revalidates relevant page caches
- `lib/actions/admin/deactivateFeaturedSlot.ts` — Server Action; admin-only; sets `is_active = false`; writes audit log; revalidates
- "Sponsored" badge: added to existing listing card components (`ListingCard`, `FeaturedListingCard`) where the listing's `id` matches an active slot in the page's context
- `lib/services/featuredSlots.ts` — `getActiveSlotsForContext(type, city?, category?)` — used by Server Components on city/category/homepage pages to determine which listing IDs have sponsored placement
- Cache strategy: featured slot data is fetched once per page render (server-side); no real-time updates needed at MVP

**Out of scope:**
- Self-serve sponsorship purchase for vendors — admin-only at MVP
- Payment processing for sponsored placements — handled off-platform (invoicing); this ticket is management-only
- Sponsored placement analytics — deferred
- Rotation/scheduling across multiple sponsors for the same slot — deferred (first active slot wins)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 009 — `listings` base table (FK for featured_slots) | Blocking ticket | Not started |
| Ticket 037 — Admin layout and auth guard | Blocking ticket | Not started |
| Ticket 012 — `admin_audit_log` table | Blocking ticket | Not started |
| Ticket 027 — City landing pages (ListingCard component to add badge to) | Soft dependency | Not started |
| Ticket 028 — City-category landing pages | Soft dependency | Not started |
| Ticket 016 — Homepage (FeaturedListingCard component) | Soft dependency | Not started |

---

## UX Notes

- **Screen:** Admin Sponsorships — `/admin/sponsorships`
- **Layout:** Standard admin layout with left sidebar nav (Ticket 037); "Sponsorships" as active nav item
- **Entry points:** Admin sidebar nav "Sponsorships"
- **Exit points:** Listing name link → admin listing detail; Deactivate → in-place row update

**Create slot form (inline panel or modal):**
- Listing search (text search autocomplete against published listings)
- Slot type: radio group (`homepage` / `city` / `category`)
- City slug: text input; required if `slot_type = 'city'` or `'category'`
- Category slug: text input; required if `slot_type = 'category'`
- Start date: date picker (defaults to today)
- End date: date picker (must be after start date)
- Save button

**"Sponsored" badge on listing cards (public-facing):**
- Small badge in the top-left corner of the listing card image area
- Text: "Sponsored" in Quicksand Bold Italic
- Background: Amber Gold `#E2A428`; text: Brand Black `#000000`
- Only shown when `getActiveSlotsForContext()` returns the listing's ID for the current page context

**Mobile behavior:** Admin is desktop-primary. Table scrolls horizontally on mobile. The "Sponsored" badge on listing cards is visible on all screen sizes.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `Badge`, `Button`, `Dialog`, `Form`, `Input`, `RadioGroup`, `Label`, `Skeleton`
- **Sponsored badge:** `absolute top-2 left-2 bg-[#E2A428] text-black text-xs font-bold px-2 py-0.5 rounded`
- **Slot type badges:** "Homepage" (blue), "City" (green), "Category" (purple) — color-coded in the admin table
- **Active indicator:** Green dot or "Active" badge; "Inactive" gray badge
- **States to implement:** Loading (table skeleton), Empty (no slots), Error (fetch failure), Success (table with slots)

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` § Sponsorships
- **Entities involved:** `featured_slots` (new), `listings`, `admin_audit_log`
- **Operations:**
  - `createFeaturedSlot`: INSERT `featured_slots` + INSERT `admin_audit_log` + revalidate
  - `deactivateFeaturedSlot`: UPDATE `featured_slots SET is_active = false` + INSERT `admin_audit_log` + revalidate
  - `getActiveSlotsForContext`: SELECT `featured_slots WHERE is_active = true AND now() BETWEEN starts_at AND ends_at AND slot_type = $type [AND city_slug = $city] [AND category_slug = $category]`

### featured_slots table

```sql
CREATE TABLE featured_slots (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id      uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  slot_type       text NOT NULL CHECK (slot_type IN ('homepage', 'city', 'category')),
  city_slug       text,          -- required when slot_type IN ('city', 'category')
  category_slug   text,          -- required when slot_type = 'category'
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT featured_slots_end_after_start CHECK (ends_at > starts_at),
  CONSTRAINT featured_slots_city_required
    CHECK (
      (slot_type IN ('city', 'category') AND city_slug IS NOT NULL) OR
      slot_type = 'homepage'
    ),
  CONSTRAINT featured_slots_category_required
    CHECK (
      (slot_type = 'category' AND category_slug IS NOT NULL) OR
      slot_type != 'category'
    )
);

CREATE INDEX featured_slots_listing_id_idx ON featured_slots (listing_id);
CREATE INDEX featured_slots_active_context_idx
  ON featured_slots (slot_type, city_slug, category_slug, is_active)
  WHERE is_active = true;   -- partial index for fast context queries

CREATE INDEX featured_slots_date_range_idx ON featured_slots (starts_at, ends_at);

CREATE TRIGGER set_featured_slots_updated_at
  BEFORE UPDATE ON featured_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**RLS:**
- `anon` and `authenticated` SELECT: `WHERE is_active = true AND now() BETWEEN starts_at AND ends_at` — only active, current slots visible publicly
- Admin INSERT/UPDATE: service role only
- No public INSERT/UPDATE/DELETE

**Migration required:** Yes — `featured_slots` table

---

## API Notes

No new Route Handler endpoints in this ticket. The sponsorship data is read server-side by page Server Components using `getActiveSlotsForContext()` from `lib/services/featuredSlots.ts`.

**`getActiveSlotsForContext` signature:**
```typescript
export async function getActiveSlotsForContext(
  type: 'homepage' | 'city' | 'category',
  citySlug?: string,
  categorySlug?: string
): Promise<Set<string>>   // Set of listing IDs with active sponsored placement
```

Usage in city page Server Component:
```typescript
const sponsoredListingIds = await getActiveSlotsForContext('city', citySlug)
// Pass to listing card: <ListingCard isSponsored={sponsoredListingIds.has(listing.id)} ... />
```

**Cache strategy:** `getActiveSlotsForContext` is called within Server Components; no explicit caching needed beyond the ISR revalidation of the parent page. When admin creates or deactivates a slot, call `revalidatePath` for the affected pages:
- `slot_type = 'homepage'`: `revalidatePath('/')`
- `slot_type = 'city'`: `revalidatePath('/[citySlug]')`
- `slot_type = 'category'`: `revalidatePath('/[citySlug]/[categorySlug]')`

---

## Implementation Notes

**Files to create:**
- `supabase/migrations/[timestamp]_create_featured_slots_table.sql`
- `app/admin/sponsorships/page.tsx`
- `lib/actions/admin/createFeaturedSlot.ts`
- `lib/actions/admin/deactivateFeaturedSlot.ts`
- `lib/services/featuredSlots.ts` — `getActiveSlotsForContext()`
- `components/admin/sponsorships/FeaturedSlotTable.tsx` — Client Component
- `components/admin/sponsorships/CreateSlotDialog.tsx` — create form in a Dialog

**Files to modify:**
- Admin sidebar nav — add "Sponsorships" link
- `components/discovery/ListingCard.tsx` — add `isSponsored?: boolean` prop; render "Sponsored" badge when true
- `components/discovery/FeaturedListingCard.tsx` — same `isSponsored` prop pattern
- City page (`app/[city-slug]/page.tsx`) — call `getActiveSlotsForContext('city', citySlug)` and pass `isSponsored` to each `ListingCard`
- City-category page (`app/[city-slug]/[category-slug]/page.tsx`) — same pattern
- Homepage (`app/page.tsx`) — call `getActiveSlotsForContext('homepage')`

**Key patterns:**
- `getActiveSlotsForContext` returns a `Set<string>` of listing IDs for O(1) lookup when rendering each card
- Pass `isSponsored` as a prop to `ListingCard` — do not fetch slot data inside the card component
- Zod validation for create slot: `ends_at` must be after `starts_at`; `city_slug` required for city/category types; `category_slug` required for category type
- Admin auth check: same service-role pattern as Ticket 074
- `insertAuditLog` required for both `createFeaturedSlot` and `deactivateFeaturedSlot`

**Do not:**
- Fetch active slots client-side — this is a server-side data fetch for ISR pages
- Allow overlapping active slots for the same listing in the same context — the DB does not enforce this; add a server-side check in `createFeaturedSlot` if `slot_type + city_slug + category_slug` already has an active slot for this listing

---

## Acceptance Criteria

- [ ] `featured_slots` table exists with all fields, constraints, and indexes
- [ ] Given admin navigates to `/admin/sponsorships`, the table lists all active and inactive sponsored slots
- [ ] "Create slot" dialog opens when admin clicks "Create slot"; form validates all required fields based on slot type
- [ ] `createFeaturedSlot` inserts the slot, writes to `admin_audit_log`, and revalidates the affected page cache
- [ ] `deactivateFeaturedSlot` sets `is_active = false`, writes to `admin_audit_log`, and revalidates cache
- [ ] City pages render "Sponsored" Amber Gold badge on listing cards for listings with active city-type slots matching `city_slug`
- [ ] City-category pages render "Sponsored" badge for active category-type slots matching both `city_slug` and `category_slug`
- [ ] Homepage renders "Sponsored" badge for active homepage-type slots
- [ ] Slots with `ends_at` in the past are not returned by `getActiveSlotsForContext` (regardless of `is_active`)
- [ ] DB constraints enforce: `ends_at > starts_at`; `city_slug NOT NULL` for city and category types; `category_slug NOT NULL` for category type
- [ ] Non-admin callers of `createFeaturedSlot` or `deactivateFeaturedSlot` receive `FORBIDDEN`

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Slot creation fails | DB constraint violation or Stripe error | Toast in admin: "Couldn't create slot. Check dates and try again." | Correct form and retry |
| Deactivation fails | DB error | Toast: "Couldn't deactivate slot. Try again." | Retry |
| `getActiveSlotsForContext` DB error | Supabase unreachable during page render | No "Sponsored" badges shown; page still renders (graceful degradation) | DB recovers; next page render shows badges |
| Admin table fails to load | Fetch error | Error state with retry in admin table | Retry |

---

## Edge Cases

- Two active slots for the same listing on the same page (e.g., admin creates two overlapping homepage slots) — both are returned by `getActiveSlotsForContext`; the `ListingCard` only renders one "Sponsored" badge (it checks `sponsoredListingIds.has(listing.id)`, which is true once regardless of multiple slots)
- Slot with `starts_at` in the future is not active yet — `getActiveSlotsForContext` filters `now() BETWEEN starts_at AND ends_at`; future slots are excluded
- Listing is archived or unpublished but has an active slot — the listing doesn't appear in city page queries anyway; the slot is effectively inert until the listing is republished
- Admin deactivates a slot mid-page render — the ISR cache is invalidated; visitors on the old ISR version see the badge until the page revalidates (acceptable at 1h ISR)
- `city_slug` or `category_slug` with incorrect casing — stored as-is in the DB; `getActiveSlotsForContext` uses case-sensitive match; slugs should always be lowercase (enforce in `createFeaturedSlot` validation: `.toLowerCase()` transform)

---

## Accessibility Notes

- [ ] "Sponsored" badge: `aria-label="Sponsored listing"` — the text "Sponsored" also conveys the information; use both
- [ ] Admin table: `<th scope="col">` on all headers
- [ ] Create slot `Dialog` traps focus; returns focus to "Create slot" button on close
- [ ] Date pickers have associated labels and are keyboard-operable
- [ ] Slot type radio group has a `<legend>` label

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Create homepage slot | Admin | Open `/admin/sponsorships`; create a homepage slot for listing X with starts_at=today, ends_at=tomorrow | Slot appears in table; homepage listing card for listing X shows "Sponsored" badge after revalidation |
| QA-2 | Create city slot | Admin | Create a city slot for city="atlanta", listing Y | Atlanta city page shows "Sponsored" badge on listing Y |
| QA-3 | Deactivate slot | Admin | Click "Deactivate" on an active slot; confirm | Slot row shows "Inactive"; badge removed from city page after revalidation |
| QA-4 | Expired slot not shown | Admin | Create a slot with `ends_at` in the past | No "Sponsored" badge on any public page; slot appears in admin table with expired indicator |
| QA-5 | DB constraint: end before start | Admin | Create slot with `ends_at` before `starts_at` | Validation error: "End date must be after start date." |
| QA-6 | Non-admin forbidden | Supporter | Call `createFeaturedSlot` SA | Returns `FORBIDDEN` |

---

## Security Notes

- All admin mutations use `createServiceRoleClient()` and check admin role — standard pattern
- `city_slug` and `category_slug` inputs are sanitized and lowercased before storage — prevent case inconsistency
- Public-facing `getActiveSlotsForContext` uses anon Supabase client; RLS ensures only `is_active = true` and current slots are returned
- Listing ID in `featured_slots` references a real listing — DB FK constraint prevents orphaned slot records

---

## Completion Checklist

- [ ] `featured_slots` table migration created with all constraints and indexes
- [ ] `app/admin/sponsorships/page.tsx` created with admin auth guard
- [ ] `createFeaturedSlot` SA implemented with validation, audit log, and revalidation
- [ ] `deactivateFeaturedSlot` SA implemented with audit log and revalidation
- [ ] `getActiveSlotsForContext` service function implemented
- [ ] "Sponsored" badge added to `ListingCard` and `FeaturedListingCard` via `isSponsored` prop
- [ ] City, city-category, and homepage pages call `getActiveSlotsForContext` and pass `isSponsored`
- [ ] Admin sidebar nav includes "Sponsorships" link
- [ ] All acceptance criteria verified
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] "Sponsored" badge visible on mobile at 375px
- [ ] Keyboard navigation on Create slot Dialog
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
