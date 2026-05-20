# Ticket 022: Business BLACQList Page — Gallery, Services, and Primary CTA Sections

**Ticket ID:** BLACQ-022
**Title:** Business BLACQList Page: gallery, services, and primary CTA sections
**Type:** Feature
**Priority:** P1 — Critical
**Estimate:** L (4–8h)
**Status:** Backlog
**Phase:** Phase 3: Entity Pages as BLACQList Micro-Websites
**Feature Area:** BLACQList Page / Public Discovery

---

## Context

Following the hero and informational sections (Ticket 021), the gallery, services, and primary CTA sections are the next three content zones on a Business BLACQList Page. The gallery demonstrates what the business looks like — it is the visual credibility layer. The services list communicates what the business sells or offers. The primary CTA card is a high-impact repeated action trigger positioned after the visitor has read enough to act. Together these three sections convert informed visitors into customers.

Source artifacts:

- `docs/blacqlist/design/blacqlist-page-design-system.md` — Sections 7.1, 8.1, 13
- `docs/blacqlist/ux/mvp-screen-map.md` — Business BLACQList Page: gallery, services, and sticky CTA spec
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Section 3.5 (gallery loading), Section 3.4
- `docs/blacqlist/architecture/api-contract.md` — Endpoint 5: `EntityPageData.media`, `EntityPageData.services`

This ticket depends on Ticket 021 (hero, about, hours, contact sections). Save/share and the sticky CTA bar are Ticket 024.

---

## User Story

> As a visitor on a Business BLACQList Page, I want to view photos of the business, understand what services they offer and at what price, and have a clear repeated call-to-action after scrolling through the content, so that I can make an informed decision and take action without scrolling back to the top.

---

## Scope

**In scope:**

- Gallery section (`#19191E` Deep Background): "Photos" h2 heading (Glacial Indifference Bold, White); mixed-size grid layout (desktop: one large featured image left + 2-column grid right; mobile: full-width featured + 2-column grid below); up to 12 images (Free tier: 6 max); each image is `next/image`; "View all [N] photos" Amber Gold text link; section hidden entirely when no gallery images exist
- Lightbox: full-screen overlay (`rgba(0,0,0,0.92)` background), centered image (max 90vw × 85vh, aspect ratio preserved), image counter "3 / 12" (White, Lato Regular 14px, upper-right), left/right arrow buttons (40px × 40px, semi-transparent dark background, White icon), Escape key closes on desktop, swipe left/right on mobile, close button (×) upper-left, focus trapped within lightbox, focus returns to trigger on close
- Services section (White background): "Services" h2 heading; row-list layout with bottom border per row in Pale Lavender; service name (Lato Medium 16px), description (Quicksand Bold Italic 14px Charcoal, 2-line max with ellipsis), price (right-aligned, Lato Regular 14px Amber Gold); up to 8 rows shown by default; "Show all [N] services" Amber Gold expand link if more than 8; section hidden entirely if no services exist
- Primary CTA card: full-width card, Amber Gold background (`#E2A428`), Brand Black text, CTA label from `cta_type`, CTA icon left of label; if `cta_type = 'call'` — clicking initiates `tel:` link; if `cta_type = 'book'` or `'order'` — opens `cta_url` in new tab; fires analytics event `cta_clicked` on click (fire-and-forget via `POST /api/analytics/event`)
- Gallery tier enforcement: Free listing max 6 images rendered (even if more exist in `media` array); Standard/Premium max 12
- Gallery images ordered by `display_order` from `media` array

**Out of scope:**

- Save/share buttons and sticky CTA bar (Ticket 024)
- SEO metadata (Ticket 023)
- Reviews, related listings (V1)
- Video embeds in gallery (V1)
- Services editor (Owner Dashboard — separate ticket)
- Portfolio/Creative gallery layout variant (Beta)

---

## Dependencies

| Dependency                                                               | Type            | Status                                                                      |
| ------------------------------------------------------------------------ | --------------- | --------------------------------------------------------------------------- |
| BLACQ-021: Hero, about, hours, contact, social sections                  | Blocking ticket | Not started                                                                 |
| BLACQ-020: Listing page data fetching and `EntityPageData` shape         | Blocking ticket | Not started                                                                 |
| `EntityPageData.media` and `EntityPageData.services` arrays (Endpoint 5) | Data contract   | Defined in api-contract.md                                                  |
| `POST /api/analytics/event` endpoint (Endpoint 17)                       | API dependency  | Not started — fire-and-forget; stub with console.log if not yet implemented |
| Brand color tokens and font configuration                                | Design tokens   | Must exist before this ticket                                               |

---

## UX Notes

- **Screen:** Business BLACQList Page — `/[city-slug]/business/[listing-slug]`
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → Business BLACQList Page — gallery, services, gallery spec
- **Entry points:** Inline section reached by scrolling or anchor from sticky CTA bar "Photos" link
- **Exit points:** Lightbox (opens over page), CTA card (navigates externally or initiates call), "Show all services" expand (in-page)
- **Mobile behavior (375px):** Gallery: featured image full-width 375px × 240px, remaining images in 2-column grid (~180px × 180px square each). Services: single-column, full-width rows, price right-aligned. Primary CTA card: full-width, stacked with large text and icon. Lightbox: swipe left/right navigation, no arrow buttons, Escape key not applicable — close button only.
- **Gallery loading state:** Gallery grid shows 6–12 skeleton image blocks at correct aspect ratios while images are loading (section-level Suspense boundary). Per `empty-loading-error-success-states.md` Section 3.5 — gallery loads independently after page frame is visible.
- **Gallery error state:** "Gallery couldn't load. Try again" inline text link within the gallery section. Does not trigger full-page error.
- **Gallery hidden state:** When `media` array filtered to `attachment_type = 'gallery'` returns 0 items, the entire gallery section (including the "Photos" heading) is not rendered. No "No photos yet" state.
- **Services hidden state:** When `services` array is empty or all services have `is_visible = false`, the services section (including the "Services" heading) is not rendered.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md` — Sections 7.1, 8.1
- **Components to use:** `next/image` (all gallery images), shadcn/ui `Dialog` (lightbox — or custom implementation with focus trap), shadcn/ui `Card` (services section container is not a card — use row-list pattern instead), custom `ServiceRow` component
- **Gallery grid desktop:** CSS grid with 2-column layout inside the 960px container. First image: `col-span-1 row-span-2` (large, left half, ~460px × 320px). Remaining images: `col-span-1` in the right half. Max 5 images shown in the grid (6th+ hidden behind "View all" lightbox trigger). All images use `object-fit: cover`.
- **Gallery grid mobile:** First image `w-full h-[240px]`. Below: 2-column grid, images `aspect-square`.
- **Lightbox implementation:** Use shadcn/ui `Dialog` with `DialogContent` removing the default padding and borders, OR implement with a portal-rendered div. The lightbox must trap focus. Arrow buttons: `Button` variant="ghost" with lucide-react `ChevronLeft` / `ChevronRight`. Close button: `Button` variant="ghost" with `X` icon. Current image: `<img>` or `next/image` with `unoptimized` to avoid Next.js size optimization constraints on the lightbox.
- **Services rows:** No card shadows. Each row: `flex justify-between items-start py-4 border-b border-[#E9E9F7]`. Last row has no bottom border. Service description: CSS `line-clamp-2` on a `<p>` element.
- **Primary CTA card:** `bg-[#E2A428] text-black rounded-xl p-8 flex items-center gap-4`. CTA label: Quicksand Bold Italic, large (text-2xl on desktop, text-xl mobile). Icon: lucide-react, 32px, Brand Black. Full-width within the 960px content container.
- **States to implement:** Gallery — loading skeleton, loaded, section hidden (no images), error (inline retry), lightbox open/closed. Services — loaded, section hidden (no services), expanded (show all). CTA card — default, hover (slight opacity shift), loading (CTA initiates async), disabled (if cta_url null and cta_type is not 'call').

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `media_attachments`, `services`
- **Entities involved:** `media_attachments` (via `EntityPageData.media`), `services` (via `EntityPageData.services`)
- **Operations:** SELECT only (consumed from `EntityPageData` props)
- **Gallery data:** `EntityPageData.media` array filtered client-side to `attachment_type = 'gallery'` (the API returns all media; components filter as needed). Ordered by `display_order` ASC. Generate public URLs from `file_path` via `getPublicUrl` in the parent page Server Component — pass as resolved URL array to gallery component.
- **Gallery tier enforcement:** Apply in the gallery component: `const galleryImages = isFreeTier ? media.slice(0, 6) : media.slice(0, 12)`. `isFreeTier = listing.listing_tier === 'free'`.
- **Services data:** `EntityPageData.services` filtered to `is_visible = true`, ordered by `display_order`. The API already filters for `is_visible = true` for non-owner requests.
- **Price display:** No currency formatting library required at MVP. `price_type` determines display: `'fixed'` → `$XX.XX`, `'starting-at'` → "From $XX", `'hourly'` → "$XX/hr", `'custom'` → `price_note`, `'free'` → "Free". `price_note` is the override label when `price_type = 'custom'`.
- **RLS:** Public read of published listing data. No auth required.
- **Migration required:** No.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md`
- **Endpoints involved:**
  - `GET /api/listings/[city-slug]/[entity-type]/[listing-slug]` (Endpoint 5) — data source via Ticket 020
  - `POST /api/analytics/event` (Endpoint 17) — CTA click event, fire-and-forget
- **CTA click analytics:** Fire `POST /api/analytics/event` with `{ event_name: 'cta_clicked', entity_id: listing.id, properties: { cta_type, listing_id } }`. Do not await the response. Do not surface errors to the user if analytics fails.
- **Auth required:** No for data reads; Yes for analytics event (but analytics accepts Anonymous per Endpoint 17 spec — no auth check needed on client)
- **Error codes to handle:** Gallery fetch errors are section-level (inline retry, not full-page). CTA analytics errors are silently swallowed.

---

## Implementation Notes

**Files to create:**

- `app/[city-slug]/business/[listing-slug]/components/GallerySection.tsx` — Gallery grid with `"use client"` for lightbox state, skeleton, and error state
- `app/[city-slug]/business/[listing-slug]/components/GalleryLightbox.tsx` — Lightbox overlay with focus trap, keyboard navigation, swipe support
- `app/[city-slug]/business/[listing-slug]/components/ServicesSection.tsx` — Server Component, row list with expand toggle
- `app/[city-slug]/business/[listing-slug]/components/PrimaryCtaCard.tsx` — `"use client"` only for analytics event fire on click
- `lib/utils/price.ts` — `formatPrice(price: number | null, price_type: string | null, price_note: string | null): string | null` utility

**Files to modify:**

- `app/[city-slug]/business/[listing-slug]/page.tsx` — Add GallerySection, ServicesSection, PrimaryCtaCard in correct section order (after SocialLinksSection from Ticket 021)

**Key patterns:**

- `GallerySection` is a `"use client"` component because lightbox state (open/closed, current image index) requires `useState`. The gallery image list is passed as resolved URL props from the parent Server Component.
- The lightbox uses `useEffect` for keyboard event listener (Escape to close, ArrowLeft/ArrowRight to navigate). Cleanup the event listener on unmount.
- Swipe support on mobile: use `onTouchStart` + `onTouchEnd` to detect swipe direction. Threshold: 50px horizontal delta.
- Focus trap in lightbox: on open, `document.getElementById('lightbox-close-btn').focus()`. On close, return focus to the "View all photos" link that triggered the open. Use a `ref` to store the trigger element before opening.
- `ServicesSection` is a Server Component. The "Show all" expand toggle requires `"use client"` — extract to a `ServicesExpandToggle` Client Component that wraps the hidden rows.
- `PrimaryCtaCard` fires analytics on click. The click handler is minimal: `() => { fireAnalytics('cta_clicked', ...) }` — do not make the user wait for the analytics response before navigating.
- Image alt text pattern: `"[business name] — photo [n]"` (design system Section 16.2). If the media record has `alt_text`, use that instead.
- Gallery images: pass resolved CDN URLs (not storage paths) to the Gallery component. Generate URLs in the parent page Server Component: `media.map(m => ({ ...m, url: supabase.storage.from('listing-media').getPublicUrl(m.file_path).data.publicUrl }))`.

**Do not:**

- Put lightbox state in the parent page component (keep it local to GallerySection).
- Render gallery images with `<img>` — always use `next/image` outside the lightbox. Inside the lightbox, `next/image` with `unoptimized` is acceptable since the lightbox serves full-size images.
- Show an empty gallery section, empty services section, or empty heading when data is missing — hide the entire section.
- Add the Web Share API or clipboard save logic here — that is Ticket 024.

---

## Acceptance Criteria

- [ ] Given a listing with 8 or more gallery images, the gallery section renders with the featured large image on the left and a 2-column grid on the right (desktop); on mobile, featured image full-width then 2-column grid.
- [ ] Given a listing with fewer than 3 gallery images, the gallery renders a narrower single-row layout (not the split featured layout).
- [ ] Given a `listing_tier = 'free'` listing with 10 gallery images, only 6 images render in the gallery — the remaining 4 are not displayed.
- [ ] Given a listing with no gallery images, the gallery section (including the "Photos" h2) is entirely absent from the DOM.
- [ ] Given the user clicks "View all [N] photos", the lightbox opens with the first image, keyboard arrow navigation works (left/right arrows and ArrowLeft/ArrowRight keys), Escape closes the lightbox, and focus returns to the "View all photos" link that opened it.
- [ ] Given the lightbox is open on mobile, swiping left shows the next image and swiping right shows the previous image; no arrow buttons are visible on mobile.
- [ ] Given a listing with 5 services, all 5 rows render without the "Show all" toggle.
- [ ] Given a listing with 10 services, the first 8 rows render by default and "Show all 10 services" Amber Gold link renders below; clicking it reveals the remaining 2 rows.
- [ ] Given a listing with no visible services, the services section (including the "Services" h2) is entirely absent from the DOM.
- [ ] Given a service with a price of type `'starting-at'` and price of `50`, the price column shows "From $50" in Amber Gold.
- [ ] Given the primary CTA card with `cta_type = 'call'`, clicking the card initiates a `tel:` link; given `cta_type = 'book'` with a `cta_url`, clicking opens the URL in a new tab.
- [ ] The `cta_clicked` analytics event fires on primary CTA card click (fire-and-forget — does not block navigation).
- [ ] At 375px, gallery images in the grid are square-cropped, services rows are full-width, and the primary CTA card text and icon stack correctly.
- [ ] Gallery lightbox close button (`×`) is the first focusable element when the lightbox opens; all lightbox controls are keyboard-navigable.

---

## Failure States

| Failure                                                      | Condition                                    | User sees                                                                                                    | Recovery                                   |
| ------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Gallery image fails to load                                  | Individual image CDN error                   | `next/image` error boundary renders image placeholder; other gallery images unaffected                       | No explicit retry per image                |
| Gallery section fetch error (if fetched separately)          | API/network error on gallery data            | "Gallery couldn't load. Try again." inline text — section-level failure does not affect rest of page         | "Try again" link re-fetches gallery images |
| CTA `cta_url` is null for a non-call CTA type                | Data inconsistency                           | CTA card renders but button is disabled with `aria-disabled="true"` and a visible tooltip "Link unavailable" | Owner must update their page to fix        |
| Analytics event fails to fire                                | Network error on `POST /api/analytics/event` | User sees nothing — fire-and-forget, silently swallowed                                                      | N/A                                        |
| Services load but all have `is_visible = false`              | Owner hid all services                       | Services section hidden entirely                                                                             | N/A                                        |
| Price data is `price_type = 'custom'` with null `price_note` | Incomplete data                              | Price column is empty (no text rendered) — not shown as an error                                             | N/A                                        |

---

## Edge Cases

- Gallery has exactly 1 image: full-width featured image at the standard height; "View all 1 photo" link opens lightbox showing that single image with no navigation arrows.
- Gallery has exactly 2 images: single-row layout with two images side by side; lightbox has navigation between the two.
- Services list has 8 services exactly: all 8 render without the "Show all" toggle (threshold is "more than 8").
- Service name is 60+ characters: wraps to two lines in the name column; description below it remains 2-line clamped.
- CTA `cta_url` is a `tel:` URI when `cta_type = 'call'`: render as `<a href="tel:...">` — no external URL behavior.
- Lightbox opened, user presses Tab: focus cycles only within the lightbox (close button, image, prev/next arrows). Tab from last focusable element wraps to first.
- User navigates to the last image in lightbox and presses ArrowRight: wrap to first image (circular navigation).
- User navigates to the first image in lightbox and presses ArrowLeft: wrap to last image.
- Gallery section is the last section on the page (no services, no CTA): page ends with the Deep Background gallery section — the Related Discovery section from V1 will follow.

---

## Accessibility Notes

- [ ] "View all [N] photos" link: `aria-label="View all [N] photos of [Business Name]"`.
- [ ] Lightbox: focus trapped within the lightbox when open. `aria-modal="true"` on the lightbox container. `role="dialog"`. `aria-label="Photo gallery for [Business Name]"`.
- [ ] Lightbox close button: `aria-label="Close gallery"`.
- [ ] Lightbox prev/next buttons: `aria-label="Previous photo"` / `aria-label="Next photo"`.
- [ ] Lightbox image counter (e.g., "3 / 12"): visually rendered text; also included in `aria-live="polite"` region so screen readers announce current position.
- [ ] Each gallery image has alt text: `"[Business Name] — photo [n]"` or owner-provided `alt_text`.
- [ ] Services section: service names use `h3`. Services description uses `<p>`. Price column is not a heading — `<span>` with `aria-label="Price: [price display]"`.
- [ ] Primary CTA card: semantic `<a>` if external URL, `<button>` or `<a href="tel:...">` if call. Accessible label matches visible text.
- [ ] All interactive elements keyboard-reachable with Enter/Space.

---

## QA Test Cases

| ID       | Test                            | Steps                                                                      | Expected                                                                                                                          |
| -------- | ------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| QA-022-1 | Gallery grid layout desktop     | Navigate to a listing with 8 gallery images on a 1280px viewport           | Featured large image on left half, 2-column grid on right, "View all 8 photos" link below grid                                    |
| QA-022-2 | Lightbox open/close/navigate    | Click "View all photos", navigate with ArrowRight × 3, press Escape        | Lightbox opens at photo 1; counter shows "1 / N"; ArrowRight advances counter; Escape closes and focus returns to "View all" link |
| QA-022-3 | Free tier gallery cap           | Navigate to a `listing_tier = 'free'` listing with 9 gallery images        | Only 6 images visible in the gallery grid                                                                                         |
| QA-022-4 | Services expand                 | Navigate to a listing with 10 services                                     | 8 rows visible, "Show all 10 services" link below; click link reveals remaining 2 rows                                            |
| QA-022-5 | Empty gallery section           | Navigate to a listing with no gallery images                               | Gallery section entirely absent — no heading, no grid, no empty state message                                                     |
| QA-022-6 | CTA card call action            | Navigate to a listing with `cta_type = 'call'`, click the primary CTA card | `tel:` link triggered (browser prompts to call on desktop or initiates call on mobile)                                            |
| QA-022-7 | Mobile gallery swipe            | Open gallery lightbox on 375px viewport, swipe left                        | Next image shown; swipe right shows previous image; no arrow buttons visible                                                      |
| QA-022-8 | Keyboard focus trap in lightbox | Open lightbox, press Tab repeatedly                                        | Focus cycles only within lightbox: close button → prev arrow → image → next arrow → close button (wraps)                          |

---

## Security Notes

- Gallery CDN URLs are generated server-side from storage paths — never constructed from unvalidated user input on the client.
- All external links (website, CTA `cta_url`, social links) use `rel="noopener noreferrer"`.
- CTA URL from `details.cta_url` is rendered directly as an `href`. Server-side validation in Endpoint 5 ensures this is a valid `https://` URL or `tel:` URI. Do not render arbitrary `javascript:` URIs — add a URL scheme check on the client as a defense-in-depth measure: `if (!url.startsWith('https://') && !url.startsWith('tel:')) return null`.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Happy path tested: gallery, lightbox navigation, services list, CTA card
- [ ] Gallery hidden when no images — verified no empty section in DOM
- [ ] Services hidden when empty — verified no empty section in DOM
- [ ] Free tier gallery cap (6 images max) tested
- [ ] Lightbox keyboard navigation tested (arrows, Escape, Tab trap)
- [ ] Lightbox swipe navigation tested at 375px
- [ ] CTA card call action and external URL action tested
- [ ] Mobile layout tested at 375px
- [ ] Analytics event fires on CTA click (verify in network tab)
