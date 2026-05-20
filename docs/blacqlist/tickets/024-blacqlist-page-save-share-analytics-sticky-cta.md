# Ticket 024: Business BLACQList Page — Save/Share Actions, Sticky CTA Bar, and Analytics Events

**Ticket ID:** BLACQ-024
**Title:** Business BLACQList Page: save/share actions, sticky CTA bar, and analytics events
**Type:** Feature
**Priority:** P1 — Critical
**Estimate:** M (2–4h)
**Status:** Backlog
**Phase:** Phase 3: Entity Pages as BLACQList Micro-Websites
**Feature Area:** BLACQList Page / Engagement

---

## Context

The save button, share button, and sticky CTA bar are the engagement layer on the BLACQList Page. They extend the primary CTA beyond the hero scroll position and allow visitors to bookmark a business for later or share it with others. Analytics events on this page feed the owner dashboard's stats row (views, CTA clicks, saves, shares). Without this ticket, the BLACQList Page has no way to capture engagement signals and owners cannot measure their page's effectiveness.

This ticket is a `"use client"` feature — it requires browser APIs (IntersectionObserver, Web Share API, Clipboard API, navigator.onLine) and React state for save state management.

Source artifacts:
- `docs/blacqlist/design/blacqlist-page-design-system.md` — Sections 4.1, 4.2, 4.3 (Quick Action Bar), Section 3.1 (save/share in hero)
- `docs/blacqlist/ux/mvp-screen-map.md` — BLACQList Page: save button, share button, mobile sticky CTA bar
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Section 3.6 (save button states), Section 8 (global save states)
- `docs/blacqlist/architecture/api-contract.md` — Endpoints 14 (Save), 15 (Unsave), 16 (List Saves), 17 (Analytics Event)

This ticket depends on Ticket 022 (hero section with CTA button rendered, contact section rendered) for the IntersectionObserver targets. It depends on Ticket 049 (Save API implementation) per the ticket instruction — note: Ticket 049 may not yet exist; the Save API endpoints 14 and 15 are defined in the API contract and must be implemented before this ticket can be fully tested.

---

## User Story

> As a visitor on a Business BLACQList Page, I want to save the business to my account for later, share a link with someone, and always have access to the primary call-to-action even after scrolling past the hero, so that I can keep track of businesses I love and easily return to them.

---

## Scope

**In scope:**
- Save button: `"use client"` component, reads save state from `GET /api/saves?listing_id=` on mount (authenticated users only), optimistic toggle (heart outline → heart filled Amber Gold), calls `POST /api/saves` on save, `DELETE /api/saves?listing_id=` on unsave. Anonymous user clicking save: opens sign-in modal (not a redirect). Save error: toast "Couldn't save. Try again." with inline Retry. Unsaved = outline heart (White on dark, Charcoal on light); Saved = filled heart Amber Gold.
- Share button: copies `window.location.href` to clipboard (Clipboard API), shows toast "Link copied!". On mobile, calls Web Share API (`navigator.share`) if available — falls back to clipboard copy if not. Fires analytics event `listing_shared` on share.
- Sticky Quick Action Bar: fixed `bottom-0` on mobile (56px height, Deep Background `#19191E`, 1px top border `rgba(255,255,255,0.1)`), fixed just below platform nav on desktop (52px height, Deep Background). Visibility controlled by IntersectionObserver: bar becomes visible when the hero CTA button scrolls above the viewport top; bar hides when the contact section enters the viewport. Slide-up from bottom on mobile (200ms ease-out), slide-down from above on desktop. Bar contains: primary CTA button (~55% width mobile, auto-width desktop), phone icon button (only if `details.phone` exists), map/directions icon button (only if address exists — hidden for online/service-area), save icon button, share icon button. Desktop bar also shows: entity name (Lato Regular 14px White, left side, truncated at 200px).
- Analytics events (all fire-and-forget via `POST /api/analytics/event`):
  - `listing_page_viewed` — fired once on mount of the page Client Component wrapper (or in a server-side RSC — prefer server-side if possible via `listing_page_viewed` being logged at the route handler level). Per api-contract.md Endpoint 5, this event is emitted by the route handler.
  - `cta_clicked` — on primary CTA button click (both hero CTA from Ticket 021 and sticky bar CTA). This ticket adds the handler to the hero CTA; sticky bar CTA is implemented here.
  - `save_added` — on successful save toggle (after optimistic update, fire regardless of server response)
  - `save_removed` — on successful unsave
  - `listing_shared` — on share action
- `"use client"` components: `SaveButton`, `ShareButton`, `StickyCtaBar`
- The hero CTA button from Ticket 021 (`HeroSection.tsx`) must be updated to add an IntersectionObserver ref and a `cta_clicked` analytics call — coordinate with Ticket 021 implementer

**Out of scope:**
- Save API implementation (Ticket 049 or the API-layer tickets)
- Owner analytics dashboard (separate ticket)
- Save count display (Platform Activity section — V1)
- Reviews write button (V1)
- Collection appearance feature (V1)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-022: Hero section with primary CTA button element rendered (needed for IntersectionObserver target) | Blocking ticket | Not started |
| BLACQ-022: Contact section rendered (needed for IntersectionObserver hide trigger) | Blocking ticket | Not started |
| `POST /api/saves` — Save entity (Endpoint 14) | API dependency | Not started |
| `DELETE /api/saves` — Unsave entity (Endpoint 15) | API dependency | Not started |
| `GET /api/saves` — Check save state (Endpoint 16, filtered by `listing_id`) | API dependency | Not started |
| `POST /api/analytics/event` — Analytics event logger (Endpoint 17) | API dependency | Not started — fire-and-forget; stub with console.log if not implemented |
| Auth session availability on the client (Supabase `@supabase/ssr`) | Infrastructure | Must be configured |
| shadcn/ui `Toast` component and toast provider | UI infrastructure | Must be installed |

---

## UX Notes

- **Screen:** Business BLACQList Page — save/share and sticky bar
- **Flow reference:** `docs/blacqlist/design/blacqlist-page-design-system.md` Sections 4.1–4.3; `docs/blacqlist/ux/empty-loading-error-success-states.md` Section 3.6 and Section 8
- **Entry points:** Hero section (save and share buttons adjacent to CTA on desktop, below on mobile); sticky bar (visible on scroll)
- **Exit points:** Sign-in modal (anonymous save attempt), share sheet / clipboard (share action), phone call (sticky bar phone button), maps app (sticky bar directions button)
- **Mobile behavior (375px):** Save + Share are icon-only circular buttons (40px diameter, `rgba(0,0,0,0.5)` background, White icon) positioned below the primary CTA on mobile (stacked). Sticky bar bottom-fixed, 56px height: CTA fills 55% width, remaining 4 icon buttons fill the rest evenly with no labels.
- **Desktop:** Save button in hero: icon + label "Save" / "Saved" to the right of the primary CTA. Share button to the right of Save. Desktop sticky bar (52px, top-fixed below nav): entity name left, primary CTA + phone + directions + save + share right.
- **IntersectionObserver targets:** Two observations needed: (1) `#hero-cta-button` — bar shows when this exits the viewport top. (2) `#contact-section` — bar hides when this enters the viewport. Both elements must have these IDs set by their respective components.
- **Sign-in modal for anonymous save:** shadcn/ui `Dialog`. Heading: "Sign in to save listings." Body: "Keep track of the Black-owned businesses you love." Primary CTA: `<a href="/sign-in?next=[current-url]">Sign in</a>` in Amber Gold. Secondary: `<a href="/sign-up">Create an account</a>`. Modal does not redirect the page — user dismisses and can sign in separately.
- **Save state check on mount:** `GET /api/saves?listing_id=[id]` — but Endpoint 16 lists all saves, not a single listing check. Pattern: on mount, check if the current user is authenticated; if yes, fetch `GET /api/saves` (paginated list) and check if `listing_id` appears, OR use `GET /api/saves?listing_id=...` if the API supports it. Per Endpoint 16 spec, the current save list endpoint does not support `listing_id` query param — the save state is returned in `EntityPageData.is_saved` (Endpoint 5). Use `EntityPageData.is_saved` as the initial state, passed as a prop to `SaveButton`. No separate mount-time fetch needed.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md` — Sections 4.2, 4.3
- **Components to use:** shadcn/ui `Button` (variants: ghost, outline), shadcn/ui `Dialog` (sign-in modal), shadcn/ui toast system (`useToast` hook from `components/ui/use-toast`)
- **Save button states:**
  - Unsaved: `Heart` icon (lucide-react), outline variant, White on dark / Charcoal on light backgrounds
  - Saving: `Loader2` icon spin animation, button `disabled`
  - Saved: `Heart` icon filled, Amber Gold fill color (`text-[#E2A428]`), `fill-current`
  - Error: outline heart returns; toast appears
- **Share button:** `Share2` icon (lucide-react), same size and style as save button
- **Sticky bar CTA button:** same Amber Gold style as hero CTA. On mobile: fills ~55% of bar width. On desktop: `w-auto` content-fit.
- **Sticky bar phone icon:** `Phone` icon (lucide-react), White, 44px tap target. Wrapped in `<a href="tel:...">`.
- **Sticky bar directions icon:** `Navigation` or `MapPin` icon, White, 44px tap target. Wrapped in `<a href="https://maps.google.com/...">`.
- **Bar transition:** `transform translate-y-full → translate-y-0` for mobile bottom bar (slide up). `transform -translate-y-full → translate-y-0` for desktop top bar (slide down). `transition: transform 200ms ease-out, opacity 200ms ease-out`.
- **Bar visibility (CSS):** Use `visibility: hidden; tabindex="-1"` when not active (not `display: none`) so the transition is smooth. Use `visibility: visible; tabindex="0"` when active.
- **States to implement:** Save button — unsaved, saving, saved, error, auth-required modal. Share button — idle, copied (brief state), Web Share active. Sticky bar — hidden, sliding-in, visible, sliding-out.

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `saves`
- **Entities involved:** `saves` (read/write)
- **Operations:** The save state initial value comes from `EntityPageData.is_saved` (boolean from Endpoint 5). Writes: `INSERT` via `POST /api/saves`, `DELETE` via `DELETE /api/saves`. No direct database access in this Client Component.
- **Optimistic UI:** Toggle `isSaved` state immediately on click. Fire the API call. On error: revert state + show toast. Do not wait for API response to update the UI.
- **Initial save state:** `is_saved` from `EntityPageData` is passed as a prop from the Server Component parent to `SaveButton`. Anonymous users: `is_saved = false` always (per Endpoint 5 spec).
- **RLS:** Enforced server-side by the save/unsave Route Handlers — `WHERE user_id = auth.uid()`. No client-side RLS needed.
- **Migration required:** No.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md`
- **Endpoints involved:**
  - `POST /api/saves` (Endpoint 14) — save a listing
  - `DELETE /api/saves?listing_id=...` (Endpoint 15) — unsave a listing
  - `POST /api/analytics/event` (Endpoint 17) — fire-and-forget analytics
- **Auth required:** Yes for save/unsave (401 if anonymous — handle by showing sign-in modal)
- **Request shape (save):** `{ listing_id: string }` (UUID)
- **Response shape (save):** `{ data: { saved: true, listing_id: string } }` or error
- **Error codes to handle:**
  - `AUTH_REQUIRED` (401) → show sign-in modal
  - `NOT_FOUND` (404) → listing was removed; show toast "This listing is no longer available"
  - `VALIDATION_ERROR` (400) → should not occur with correct client code; log and show generic error toast
  - Network error / 500 → revert optimistic state, show "Couldn't save. Try again." toast with Retry action

---

## Implementation Notes

**Files to create:**
- `app/[city-slug]/business/[listing-slug]/components/SaveButton.tsx` — `"use client"`. Props: `listingId: string`, `initialIsSaved: boolean`, `listingName: string`. Manages save state with optimistic updates. Shows sign-in modal for anonymous users.
- `app/[city-slug]/business/[listing-slug]/components/ShareButton.tsx` — `"use client"`. Props: `listingName: string`. Uses `navigator.share` or `navigator.clipboard.writeText`. Fires analytics on share.
- `app/[city-slug]/business/[listing-slug]/components/StickyCtaBar.tsx` — `"use client"`. Props: `listingName: string`, `ctaType: string`, `ctaUrl: string | null`, `ctaPhone: string | null`, `hasAddress: boolean`, `initialIsSaved: boolean`, `listingId: string`. Manages IntersectionObserver and bar visibility state. Composes SaveButton and ShareButton inside the bar.
- `app/[city-slug]/business/[listing-slug]/components/SignInModal.tsx` — `"use client"`. Props: `open: boolean`, `onClose: () => void`, `currentUrl: string`. shadcn/ui Dialog.
- `lib/analytics/useAnalytics.ts` — `useAnalytics()` hook: `fireEvent(eventName: string, properties?: object)` — wrapper around `fetch('/api/analytics/event', ...)` that is fire-and-forget. No await. No error surface.

**Files to modify:**
- `app/[city-slug]/business/[listing-slug]/page.tsx` — Pass `is_saved` from `EntityPageData` as `initialIsSaved` prop to `SaveButton` and `StickyCtaBar`. Add `id="contact-section"` to the contact section wrapper.
- `app/[city-slug]/business/[listing-slug]/components/HeroSection.tsx` (Ticket 021) — Add `id="hero-cta-button"` to the primary CTA button wrapper div. Add `cta_clicked` analytics event on CTA click. Add `SaveButton` and `ShareButton` components in the hero.

**Key patterns:**

```typescript
// Optimistic save pattern
function SaveButton({ listingId, initialIsSaved, listingName }: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  async function handleToggle() {
    if (!isAuthenticated) { setShowSignInModal(true); return }
    const nextState = !isSaved
    setIsSaved(nextState)                  // optimistic
    setIsLoading(true)
    try {
      if (nextState) {
        await fetch('/api/saves', { method: 'POST', body: JSON.stringify({ listing_id: listingId }) })
        fireAnalytics('save_added', { listing_id: listingId })
      } else {
        await fetch(`/api/saves?listing_id=${listingId}`, { method: 'DELETE' })
        fireAnalytics('save_removed', { listing_id: listingId })
      }
    } catch {
      setIsSaved(!nextState)               // revert
      toast({ title: "Couldn't save.", description: "Try again.", action: <ToastAction onClick={handleToggle}>Retry</ToastAction> })
    } finally {
      setIsLoading(false)
    }
  }
}
```

```typescript
// IntersectionObserver pattern for sticky bar
useEffect(() => {
  const heroCta = document.getElementById('hero-cta-button')
  const contactSection = document.getElementById('contact-section')
  const heroObserver = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) setBarVisible(true)
    else setBarVisible(false)
  }, { threshold: 0 })
  const contactObserver = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) setBarVisible(false)
  }, { threshold: 0 })
  if (heroCta) heroObserver.observe(heroCta)
  if (contactSection) contactObserver.observe(contactSection)
  return () => { heroObserver.disconnect(); contactObserver.disconnect() }
}, [])
```

**Do not:**
- Use `display: none` for the sticky bar visibility — use `visibility: hidden` + `tabindex="-1"` so the CSS transition works.
- Show the sign-in modal as a full-page redirect — it must be an in-page modal.
- Await analytics events — always fire-and-forget.
- Implement the save API endpoints in this ticket — consume them only.

---

## Acceptance Criteria

- [ ] Given an authenticated user on a BLACQList Page where they have not saved the listing, the save button renders as an outline heart. Clicking it immediately shows a filled Amber Gold heart (optimistic update) and sends `POST /api/saves` in the background.
- [ ] Given an authenticated user who has saved the listing, the save button renders as a filled Amber Gold heart. Clicking it immediately shows an outline heart (optimistic update) and sends `DELETE /api/saves?listing_id=...`.
- [ ] Given an anonymous user who clicks the save button, a sign-in modal appears with "Sign in to save listings" heading, Sign In and Create an Account links — no page redirect occurs.
- [ ] Given a failed save API call (network error), the save button reverts to its previous state and a toast appears: "Couldn't save. Try again." with a Retry inline action.
- [ ] Given a user on a desktop browser, clicking the share button copies the current page URL to the clipboard and a "Link copied!" toast appears for 2 seconds.
- [ ] Given a user on a mobile browser with Web Share API support, clicking the share button triggers the native share sheet.
- [ ] Given the user scrolls past the hero primary CTA button, the sticky CTA bar slides up from the bottom (mobile) or slides down from below the nav (desktop) within 200ms.
- [ ] Given the user scrolls down to the contact section, the sticky CTA bar hides.
- [ ] Given the user scrolls back up past the hero CTA button, the sticky CTA bar reappears.
- [ ] The sticky bar on mobile shows: primary CTA (55% width, Amber Gold), phone icon (if phone exists), directions icon (if address exists), save icon, share icon — all with 44px minimum tap targets.
- [ ] The sticky bar on desktop shows: entity name (left, truncated at 200px), primary CTA, phone button with number, directions icon, save icon with "Save"/"Saved" label, share icon with "Share" label.
- [ ] The analytics events `save_added`, `save_removed`, and `listing_shared` fire (fire-and-forget) on their respective user actions.
- [ ] All sticky bar interactive elements (CTA, phone, directions, save, share) are keyboard-accessible and have descriptive `aria-label` attributes.
- [ ] The sticky bar is hidden from the tab order (`tabindex="-1"` and `visibility: hidden`) when not visible.

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Save API returns 401 | Session expired mid-page | Sign-in modal appears | User signs in and returns to page |
| Save API returns 404 | Listing removed since page load | Toast: "This listing is no longer available." Save button remains in pre-action state | N/A |
| Clipboard API not available | HTTP context (non-HTTPS) or browser restriction | Toast: "Couldn't copy link. Please copy from the address bar." | User manually copies URL |
| Web Share API fails | User cancels or share sheet error | Fall back to clipboard copy silently | Clipboard copy attempt |
| IntersectionObserver not supported | Very old browser | Sticky bar always visible (no IntersectionObserver-based show/hide) | Acceptable degradation |
| Analytics event fails | Network error on `POST /api/analytics/event` | Nothing visible to user — fire-and-forget | No recovery needed |
| Phone number null but sticky bar renders | Data race or bad prop | Phone icon not rendered (guard: `{details.phone && <PhoneButton />}`) | N/A — hidden by condition |

---

## Edge Cases

- User saves, then immediately unsaves before the first API call completes: cancel pattern not implemented at MVP — last action wins. The second request fires after the first regardless of response order. Idempotent API design (`ON CONFLICT DO NOTHING` for save, safe DELETE for unsave) handles this correctly.
- User opens multiple tabs of the same listing page: save state is per-tab (loaded from `EntityPageData.is_saved` at SSR time) — tabs do not sync. This is acceptable at MVP.
- Listing name is 100+ characters: sticky bar truncates at 200px (desktop) with text-overflow: ellipsis. On mobile, entity name is not shown in the bar.
- `cta_url` is `null` for a non-call CTA type in the sticky bar: the sticky bar CTA button is disabled with `aria-disabled="true"`. Do not omit it — the user needs to see that a CTA exists even if it is misconfigured.
- User on iOS Safari (no Clipboard API in older versions): the Web Share API is available on iOS Safari 14+. For older iOS: show a "Tap to copy" UI affordance or degrade to "Share" showing the URL in a selectable input field inside a modal.
- The sticky bar's IntersectionObserver fires before the DOM is fully painted (hydration timing): debounce the first observer callback by one `requestAnimationFrame` to avoid flash of bar on initial load.

---

## Accessibility Notes

- [ ] Sticky bar is removed from tab order when not visible: `tabindex="-1"` on all interactive elements within the bar, `visibility: hidden` on the bar container, when hidden.
- [ ] Save button: dynamic `aria-label` — "Save [Business Name]" when unsaved, "Remove [Business Name] from saved" when saved, "Sign in to save [Business Name]" when anonymous and about to show modal.
- [ ] Share button: `aria-label="Share [Business Name]"`.
- [ ] Sticky bar phone button: `aria-label="Call [Business Name]"`.
- [ ] Sticky bar directions button: `aria-label="Get directions to [Business Name]"`.
- [ ] Sign-in modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the modal heading ID. Focus trapped within modal when open. Focus returns to save button on modal close.
- [ ] Sticky bar CTA button (disabled state): `aria-disabled="true"` and a visible tooltip explaining why.
- [ ] Toast announcements: shadcn/ui toast uses `role="status"` or `aria-live="polite"` — verify this is in place in the toast component configuration.

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-024-1 | Authenticated save | Sign in, navigate to an unsaved listing page, click save | Heart fills Amber Gold immediately; `POST /api/saves` fires in network tab; `save_added` analytics event fires |
| QA-024-2 | Save error recovery | Mock `POST /api/saves` to return 500, click save | Heart reverts to outline; toast "Couldn't save. Try again." with Retry button appears for 5 seconds |
| QA-024-3 | Anonymous save flow | While not signed in, click save button | Sign-in modal appears with correct heading, sign-in link, and create-account link; page does not redirect |
| QA-024-4 | Sticky bar visibility | Scroll past hero CTA on a listing page | Bar slides up from bottom on mobile (200ms) after hero CTA exits viewport; bar hides when contact section enters viewport |
| QA-024-5 | Share — clipboard copy | Click share button on desktop (no Web Share API) | "Link copied!" toast appears for 2 seconds; clipboard contains the page URL |
| QA-024-6 | Sticky bar keyboard navigation | Tab to sticky bar elements when bar is visible | All CTA, phone, directions, save, share buttons are reachable; when bar is hidden, none are reachable via Tab |
| QA-024-7 | Mobile sticky bar layout | View on 375px viewport | Bar: Amber Gold CTA ~55% width, then evenly spaced icon buttons (phone if exists, directions if address exists, save, share); no labels on icons |
| QA-024-8 | Save state from SSR | Sign in, save a listing, hard-reload the page | Save button loads with filled Amber Gold heart (from `EntityPageData.is_saved = true`) — no flash of unsaved state |

---

## Security Notes

- `listing_id` is passed from Server Component props (trustworthy source) to `SaveButton` and `StickyCtaBar` — never constructed from URL manipulation on the client.
- `POST /api/saves` sets `user_id` from `auth.uid()` server-side — never accepted from the request body.
- The sign-in modal's "Sign In" link uses `?next=[current-url]` to redirect after auth — the `next` parameter is validated server-side at the `/sign-in` route to prevent open redirect attacks. Ensure `/sign-in` validates `next` as a same-origin URL only.
- Analytics events use fire-and-forget — errors from this endpoint are never surfaced to the user, preventing information leakage.
- Clipboard API is only available in HTTPS contexts — no additional security risk. The URL being copied is the page's own URL, not sensitive data.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Authenticated save/unsave flow tested end-to-end in browser
- [ ] Anonymous save → sign-in modal tested
- [ ] Save error recovery (revert + toast) tested by mocking a 500 response
- [ ] Sticky bar scroll behavior tested on both mobile (375px) and desktop (1280px)
- [ ] Sticky bar IntersectionObserver verified: shows on hero CTA exit, hides on contact section enter
- [ ] Share button — clipboard copy tested (desktop); Web Share API tested on mobile device if available
- [ ] All sticky bar elements verified keyboard-accessible when visible, inaccessible (tab order) when hidden
- [ ] `aria-label` on save button verified to change on state transition
- [ ] Analytics events (`save_added`, `save_removed`, `listing_shared`, `cta_clicked`) verified in network tab
