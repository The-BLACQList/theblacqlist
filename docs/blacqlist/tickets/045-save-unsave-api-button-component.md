# Ticket 045: Save/unsave API routes (POST/DELETE /api/saves) and SaveButton component

---

## Status
Backlog

## Phase
Phase 7: Saves, Reviews, Corrections, Sharing

## Priority
P1 — High

## Estimate
M (2–4h)

## Feature Area
Saves / Engagement

---

## Context

The save (bookmark) interaction is one of the most frequent actions on the platform. Users can save any published listing from the BLACQList Page hero, the quick-actions bar, and listing cards across search results, city pages, and the homepage. The save state is global — a listing saved on the homepage is saved everywhere.

This ticket builds the three Route Handlers for the save feature and the reusable `SaveButton` Client Component. The component uses optimistic UI: the heart fills immediately on tap, and the server request fires in the background. If the request fails, the state rolls back.

Unauthenticated users who tap Save see a sign-in modal — not a redirect. The modal must not navigate away from the current page.

Route Handlers (not Server Actions) are the correct mechanism here per the architecture decision table in `server-actions-plan.md` § 1: saves are lightweight toggles with no ISR-cached page implications.

Sources: `docs/blacqlist/architecture/api-contract.md` §§ 14, 15, 16 (Saves); `docs/blacqlist/ux/empty-loading-error-success-states.md` §§ 3.6, 8; `docs/blacqlist/architecture/server-actions-plan.md` § 1.

---

## User Story

As a logged-in supporter or owner, I want to save a listing with a single tap and see the heart fill immediately, so that I can bookmark businesses I want to remember without interrupting my browsing.

---

## Scope

**In scope:**
- `app/api/saves/route.ts` — Route Handler for `POST /api/saves` and `DELETE /api/saves`
- `app/api/saves/check/route.ts` — Route Handler for `GET /api/saves/check?listing_id=`
- `components/listing/SaveButton.tsx` — "use client"; reusable save/unsave toggle button
- `SaveButton` props: `{ listingId: string, initialSaved: boolean, listingName?: string }`
- Optimistic UI: toggle state immediately on click; sync with server; roll back on failure
- Unsaved state: outline heart icon (Cream/Charcoal depending on background context, controlled by a `variant` prop); label "Save" if space allows
- Saved state: filled Amber Gold heart; label "Saved" if space allows
- Loading state: spinner replaces icon during the in-flight request; button disabled
- Anonymous click: fires `openSignInModal()` — does not redirect; does not change the heart state
- Error state: revert optimistic state + toast "Couldn't save. Try again." with inline "Retry" button
- `POST /api/saves` fires a `listing_saved` analytics event (fire-and-forget via `POST /api/analytics/event`)
- `DELETE /api/saves` fires a `listing_unsaved` analytics event (fire-and-forget)

**Out of scope:**
- Saved Listings page `/account/saved` (Ticket 046)
- Save count badge on listing cards (aggregated by DB trigger; surfaced in Ticket 021 BLACQList Page)
- Save from the admin interface

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 011 — `saves` table migration | Blocking ticket | Not started |
| Ticket 013 — Supabase Auth session middleware | Blocking ticket | Not started |
| `SignInModal` component | Component | Must exist or be created in this ticket |
| `POST /api/analytics/event` Route Handler (Ticket 049) | Fire-and-forget API | Should exist; if not, stub with a no-op until 049 ships |

---

## UX Notes

- **Screen:** BLACQList Page quick-actions bar, listing cards (search, homepage, city pages), Saved Listings page
- **Flow reference:** `docs/blacqlist/ux/empty-loading-error-success-states.md` §§ 3.6, 8
- **Entry points:** Any screen that renders a listing card or the BLACQList Page hero
- **Exit points:** No navigation — the save action is in-place

**Save button state transitions (from `empty-loading-error-success-states.md` § 8):**

| State | Icon | Label | Button state |
|---|---|---|---|
| Unsaved | Heart outline (Cream on dark bg, Charcoal on light bg) | "Save" (if space) | Enabled |
| Saving | Spinner | — | Disabled |
| Saved | Heart filled (Amber Gold) | "Saved" (if space) | Enabled |
| Unsaving | Spinner | — | Disabled |
| Error (save failed) | Heart outline returns | — | Enabled; toast: "Couldn't save. Try again." |
| Auth required | Heart outline unchanged | — | Enabled; sign-in modal opens |

**Sign-in modal (from screen map § BLACQList Page and § 8):**
- Heading: "Sign in to save listings."
- Body: "Keep track of the Black-owned businesses you love."
- Primary CTA: "Sign in" → `/sign-in?next=[current-page-url]`
- Secondary: "Create an account" → `/sign-up`
- Both links carry `?next=[current-page-url]` so the user returns to the same listing after auth

**Mobile behavior:** On cards at 375px, the save button is icon-only (no label); tap target minimum 44×44px. On the BLACQList Page quick-actions bar, the button includes a label on mobile.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** Custom `SaveButton` built on shadcn/ui `Button` (ghost or icon variant); `BookmarkIcon` or custom heart SVG for the icon; `Dialog` for the sign-in modal; `Spinner` inline
- **Icon choice:** Use a filled/outline heart or bookmark icon from Lucide (`Heart`, `HeartOff`) — confirm with design; the icon must have a clearly distinct filled vs. outline state
- **Amber Gold fill:** `#E2A428` for the saved/active state
- **Button size variants:** `sm` for cards, `default` for the BLACQList Page hero, `lg` for the quick-actions bar on mobile
- **States to implement:** Unsaved, Saving, Saved, Unsaving, Error, Auth required (modal)

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `saves`, `listings`
- **Entities involved:** `saves`
- **Operations:**
  - `POST /api/saves`: `INSERT INTO saves (user_id, listing_id) ON CONFLICT (user_id, listing_id) DO NOTHING`; returns 201
  - `DELETE /api/saves`: `DELETE FROM saves WHERE user_id = auth.uid() AND listing_id = $listing_id`; returns 204; idempotent (204 whether or not the row existed)
  - `GET /api/saves/check`: `SELECT EXISTS (SELECT 1 FROM saves WHERE user_id = auth.uid() AND listing_id = $listing_id)`; returns `{ data: { saved: boolean } }`
  - `save_count` on `listings` is updated by a DB trigger on saves INSERT/DELETE — not managed by these endpoints
- **Validation rules:**
  - `listing_id`: required; must be a valid UUID; listing must exist with `status = 'published' AND deleted_at IS NULL` (POST only — DELETE is unconditional for the user's own save row)
- **RLS policies:** `saves` table: users can only INSERT/DELETE/SELECT their own rows (`user_id = auth.uid()`)
- **Migration required:** No — `saves` table from Ticket 011

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` §§ 14, 15, 16

**Route Handlers:**

| Method | Route | Auth | What it does |
|---|---|---|---|
| `POST` | `/api/saves` | Supporter | Insert save; idempotent via ON CONFLICT DO NOTHING; returns 201 `{ data: { saved: true, listing_id } }` |
| `DELETE` | `/api/saves` | Supporter | Delete save row; idempotent; returns 204 No Content |
| `GET` | `/api/saves/check` | Supporter | Check save status for a single listing; returns `{ data: { saved: boolean } }` |

**Request shapes:**
- POST body: `{ listing_id: string }`
- DELETE query param: `?listing_id=[uuid]` (per api-contract.md § 15 spec)
- GET query param: `?listing_id=[uuid]`

**Error codes to handle in the component:**

| Code | HTTP | UI behavior |
|---|---|---|
| `AUTH_REQUIRED` | 401 | Anonymous: open sign-in modal. Session-expired authenticated: redirect to sign-in. |
| `NOT_FOUND` | 404 | POST only — listing was deleted; revert optimistic state; toast "This listing is no longer available." |
| `VALIDATION_ERROR` | 400 | Revert optimistic state; toast "Couldn't save. Try again." |
| Network / 500 | — | Revert optimistic state; toast "Couldn't save. Try again." with Retry |

---

## Implementation Notes

**Files to create:**
- `app/api/saves/route.ts` — Route Handler; exports `POST` and `DELETE` handlers
- `app/api/saves/check/route.ts` — Route Handler; exports `GET` handler
- `components/listing/SaveButton.tsx` — "use client"; self-contained save toggle

**Files to modify:**
- `components/listing/ListingCard.tsx` — import and render `<SaveButton listingId={listing.id} initialSaved={listing.is_saved} />`
- `app/[city-slug]/business/[listing-slug]/page.tsx` — render `<SaveButton>` in the hero and quick-actions bar
- `components/ui/SignInModal.tsx` — create if it doesn't exist; used here and by other anonymous-gated actions

**Key patterns:**

```typescript
// Optimistic UI pattern in SaveButton.tsx
const [saved, setSaved] = useState(initialSaved)
const [loading, setLoading] = useState(false)

async function handleToggle() {
  if (!isAuthenticated) {
    openSignInModal()
    return
  }
  const nextState = !saved
  setSaved(nextState) // optimistic
  setLoading(true)
  try {
    if (nextState) {
      const res = await fetch('/api/saves', { method: 'POST', body: JSON.stringify({ listing_id: listingId }) })
      if (!res.ok) throw new Error()
      // fire-and-forget analytics
      fetch('/api/analytics/event', { method: 'POST', body: JSON.stringify({ event_name: 'listing_saved', entity_id: listingId }) })
    } else {
      const res = await fetch(`/api/saves?listing_id=${listingId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    }
  } catch {
    setSaved(!nextState) // rollback
    toast.error("Couldn't save. Try again.", { action: { label: "Retry", onClick: handleToggle } })
  } finally {
    setLoading(false)
  }
}
```

- POST and DELETE handlers validate `listing_id` with zod before any DB operation
- POST handler: `supabase.auth.getUser()` then INSERT with `ON CONFLICT DO NOTHING`; set `user_id` from `auth.uid()` server-side
- DELETE handler: always returns 204 regardless of whether the row existed (idempotent)
- GET /api/saves/check: lightweight — used to initialize `initialSaved` state when SSR cannot pre-determine save status (e.g., listing cards on non-personalized cached pages)
- Analytics events are fire-and-forget: `fetch('/api/analytics/event', ...)` — never `await`, wrapped in try/catch that swallows errors

**Do not:**
- Accept `user_id` from the client — always set from `auth.uid()` on the server
- Navigate the user away when they click save while anonymous — open the modal in-place
- Block the UI while the analytics event fires
- Put business logic (save logic) inside the Route Handler body — extract to a service function if it grows complex

---

## Acceptance Criteria

- [ ] Given an authenticated user clicks the save button on a listing card, then the heart icon fills with Amber Gold immediately (optimistic), `POST /api/saves` fires, and the filled state persists on success
- [ ] Given the user clicks the save button again on a saved listing, then the heart reverts to outline immediately (optimistic), `DELETE /api/saves` fires, and the outline persists on success
- [ ] Given the server returns an error on save, then the heart icon reverts to its previous state and a toast shows "Couldn't save. Try again." with an inline Retry action
- [ ] Given an unauthenticated user clicks the save button, then the sign-in modal opens with the heading "Sign in to save listings." and both "Sign in" and "Create an account" links carry `?next=[current-url]`; the heart icon does not change state
- [ ] Given `POST /api/saves` is called with a valid `listing_id`, then the server returns 201 `{ data: { saved: true, listing_id } }`; the `save_count` DB trigger fires
- [ ] Given `DELETE /api/saves` is called, then the server returns 204 No Content regardless of whether the save row existed (idempotent)
- [ ] Given `GET /api/saves/check?listing_id=[id]` is called by an authenticated user, then the response is `{ data: { saved: true/false } }`
- [ ] During any save/unsave request, the button shows a spinner and is disabled to prevent double-submission
- [ ] A `listing_saved` analytics event is fired fire-and-forget after a successful POST; a `listing_unsaved` event is fired after a successful DELETE
- [ ] Mobile at 375px: button is icon-only; tap target is at least 44×44px; no label overflow

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Network timeout | Request times out | Heart reverts; toast: "Couldn't save. Try again." with Retry | Retry button fires the same request |
| 404 from POST | Listing deleted or unpublished | Heart reverts; toast: "This listing is no longer available." | No recovery; page should be refreshed |
| 401 (no session) | Session expired for authenticated user | Toast: "Your session expired. Sign in again." + "Sign in" link | Re-authenticate; returns to page |
| 500 from server | Unexpected DB error | Heart reverts; toast: "Couldn't save. Try again." | Retry |
| Double-click before first request completes | User taps twice quickly | Button is disabled after first click; second click ignored | N/A — prevented by disabled state |

---

## Edge Cases

- User saves the same listing twice in rapid succession (e.g., two tabs) — `ON CONFLICT DO NOTHING` ensures only one save row; both calls return 201; no error
- `initialSaved` prop is `false` on a cached listing card but the user has actually saved it since the page was cached — `GET /api/saves/check` can be called on mount to sync if needed; at MVP, `initialSaved` from SSR is accepted and the user can toggle from there
- Listing is unpublished after the user's saved list is loaded — save row remains in DB; the `/api/saves` GET list filters to `deleted_at IS NULL` and excludes the listing from the saved list response, but the save row itself is not deleted
- User with a very slow connection clicks save multiple times — `loading` state disabled prevents multiple in-flight requests; only one request fires

---

## Accessibility Notes

- [ ] Save button has a descriptive `aria-label`: "Save [Business Name]" when unsaved, "Remove [Business Name] from saved" when saved
- [ ] `aria-pressed` attribute reflects the current saved state: `aria-pressed="true"` when saved
- [ ] Button is keyboard-operable: Enter and Space both trigger the toggle
- [ ] Loading state: `aria-busy="true"` on the button; spinner has `aria-hidden="true"` (the button label communicates the state)
- [ ] Toast messages are announced via `aria-live="polite"` or `role="status"`
- [ ] Sign-in modal: focus moves to the modal heading on open; focus returns to the save button on modal close; Escape closes the modal

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-1 | Happy path: save listing | 1. Log in. 2. Navigate to a listing card. 3. Click the save button. | Heart fills with Amber Gold immediately. POST request returns 201. DB save row created. Analytics event fired. |
| QA-2 | Happy path: unsave listing | 1. Log in with a saved listing. 2. Click the filled heart. | Heart reverts to outline immediately. DELETE returns 204. DB save row deleted. |
| QA-3 | Anonymous save | 1. Log out. 2. Click the save button on any listing card. | Sign-in modal opens with correct heading and `?next=` links. Heart state unchanged. No API call made. |
| QA-4 | Optimistic rollback | 1. Log in. 2. Block the `/api/saves` endpoint (e.g., via DevTools). 3. Click save. | Heart fills (optimistic). Request fails. Heart reverts. Toast: "Couldn't save. Try again." with Retry. |
| QA-5 | Idempotent unsave | 1. Delete save row directly in DB. 2. Click the filled-heart save button (which still shows saved from local state). | DELETE request fires; returns 204 even though no row exists. No error shown. |
| QA-6 | Mobile at 375px | 1. Open a listing card on a 375px device. 2. Tap the save button. | Tap target is at least 44×44px. Button responds. No label overflow. |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] `POST /api/saves`: tested with valid listing_id, missing listing_id, unauthenticated, already-saved (idempotent)
- [ ] `DELETE /api/saves`: tested with existing row, non-existent row (both return 204); unauthenticated
- [ ] `GET /api/saves/check`: returns correct `saved` boolean; unauthenticated returns 401
- [ ] Optimistic UI: tested in browser — fill/revert on success/failure
- [ ] Sign-in modal: opens for anonymous users; does not navigate away; `?next=` param correct
- [ ] Double-click prevention: button disabled during in-flight request
- [ ] Analytics events: fired fire-and-forget; do not block UI
- [ ] Mobile tested at 375px — icon-only button, tap target size
- [ ] Keyboard navigation: Enter/Space toggle; `aria-pressed` correct; `aria-label` describes action
