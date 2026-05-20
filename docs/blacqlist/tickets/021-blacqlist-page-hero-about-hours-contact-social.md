# Ticket 021: Business BLACQList Page — Hero, About, Hours, Contact, and Social Sections

**Ticket ID:** BLACQ-021
**Title:** Business BLACQList Page: hero, about, hours, contact, and social sections
**Type:** Feature
**Priority:** P1 — Critical
**Estimate:** L (4–8h)
**Status:** Backlog
**Phase:** Phase 3: Entity Pages as BLACQList Micro-Websites
**Feature Area:** BLACQList Page / Public Discovery

---

## Context

The BLACQList Page is the atomic unit of the platform — the product promise made tangible. Every listed business receives a polished micro-website that functions as its digital home. This ticket implements the above-the-fold sections and the core informational content: hero, about (story), hours of operation, contact information, and social links. These five sections are the first content a visitor sees and must immediately communicate who the business is, whether they are open, and how to reach them.

Source artifacts:
- `docs/blacqlist/design/blacqlist-page-design-system.md` — Sections 2, 3.1, 5, 6.1, 7.1, 15, 16
- `docs/blacqlist/ux/mvp-screen-map.md` — Business BLACQList Page detailed spec
- `docs/blacqlist/ux/empty-loading-error-success-states.md` — Section 3
- `docs/blacqlist/architecture/api-contract.md` — Endpoint 5: Get Entity Page by Slug

This ticket depends on Ticket 020 (listing page data fetching and route setup). It does not implement the gallery, services, save/share actions, or sticky CTA bar — those are Tickets 022 and 024.

---

## User Story

> As a visitor arriving on a Business BLACQList Page, I want to immediately see who the business is, whether they are open, how to contact them, and their social media presence, so that I can decide within seconds whether to engage with them.

---

## Scope

**In scope:**
- Hero section: full-bleed cover image (Free/Standard tier: boxed within 960px container; Premium tier: true full-bleed), bottom-to-top gradient overlay (`rgba(0,0,0,0.72)` → transparent), entity name (h1, Glacial Indifference Bold), tagline (Lato Regular, Pale Lavender, mobile-hidden), trust badge (Unclaimed = Charcoal; Claimed = Blue `#3B82F6`), primary CTA button (Amber Gold, label from `cta_type`), logo treatment (circular crop, 64px desktop / 48px mobile with 1.5px White border), tier-based hero dimensions
- At-a-Glance section: category, city, hours (open/closed computed from current time + listing timezone), phone (`tel:` link), email (`mailto:` link), website (external link, Amber Gold)
- About / Story section: description text (Quicksand Bold Italic), expand/collapse at 200 words with "Read more" / "Read less" Amber Gold toggle, smooth height transition, paragraph breaks from double newlines
- Hours section: day-by-row full weekly schedule, today's row highlighted, "Open now" (green `#16A34A`) / "Closed" indicator computed from `listing_hours` array, "Opens at [time]" when closed
- Contact section: phone (click-to-call), email (click-to-email), website (external link icon), address (link to Google Maps / Apple Maps by OS); service-area businesses show "Service area: [City]" instead of address
- Social links section: Instagram, Facebook, LinkedIn, TikTok, YouTube, custom link — rendered as circular icon buttons, only platforms with non-null URLs rendered, each opens in a new tab
- Unclaimed page claim prompt band: Pale Lavender band above At-a-Glance with "Claim This Page" Amber Gold button (secondary, not competing with primary CTA)
- Section background alternation per design system: hero (`#19191E`), At-a-Glance (White), Story (Cream `#FCFAF4`)
- All sections are Server Components — no client state required

**Out of scope:**
- Gallery section (Ticket 022)
- Services section (Ticket 022)
- Primary CTA card section (Ticket 022)
- Save button, Share button, Sticky CTA bar (Ticket 024)
- SEO metadata and JSON-LD (Ticket 023)
- Reviews section (V1)
- Related listings row (V1)
- Professional, Creative, Event, Job hero variants (Beta/V1)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-020: Listing page data fetching and route (`/[city-slug]/business/[listing-slug]`) | Blocking ticket | Not started |
| BLACQ-002: Supabase project setup and storage buckets | Infrastructure | Done |
| `EntityPageData` TypeScript interface from API Endpoint 5 | Data contract | Defined in api-contract.md |
| Glacial Indifference Bold, Lato Regular, Quicksand Bold Italic font loading | Design | Must be configured in project before this ticket |
| Brand color tokens in Tailwind config (`#E2A428`, `#19191E`, `#FCFAF4`, `#E9E9F7`, `#595758`) | Design tokens | Must exist before this ticket |

---

## UX Notes

- **Screen:** Business BLACQList Page — `/[city-slug]/business/[listing-slug]`
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → Business BLACQList Page Detailed Spec
- **Entry points:** Search results card click, city landing page card click, direct URL, shared link
- **Exit points:** Primary CTA (Book/Order/Call/Visit/Message), contact links (phone/email/website), social links, claim prompt, Google Maps link
- **Mobile behavior (375px):** Hero image 240px height. Entity name 28px, tagline hidden. Trust badge upper-left at 12px margin. CTA button full-width below name. At-a-Glance stacks vertically (all items single-column, 12px gap). Story text 15px, full-width 16px padding. Hours/Contact/Social stack in single column.
- **Desktop:** Nav transparent over hero → transitions to solid `#19191E` on scroll past hero (this nav transition is a separate nav component concern; the hero must set a `data-dark-hero` attribute for the nav to detect). Hero name 40px, 32px from left, 72px from bottom. Save + Share buttons to the right of the primary CTA.
- **Open/Closed logic:** Computed in a server-side utility function using `listing_hours` (day_of_week, open_time, close_time, is_closed) and the listing's city timezone. Today's row determined by `new Date()` in UTC offset to city timezone. "Open now" if current time is between open_time and close_time and `is_closed = false`. This is the one computation that must be correct at render time — not stale from ISR cache. Use `export const dynamic = 'force-dynamic'` on the hours section or compute with `Date.now()` + timezone offset passed as a prop from the page.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Components to use:** `next/image` (cover image, logo), shadcn/ui `Badge` (trust badge, category tags), shadcn/ui `Button` (primary CTA, contact actions), custom `ExpandableText` component for description truncation
- **Layout:** `max-w-[960px] mx-auto` content constraint. Section backgrounds extend full viewport width (`w-full`), content inside constrained. `py-12 md:py-16` section vertical padding.
- **Hero image:** `next/image` with `priority` (above fold), `fill` or explicit `width`/`height`. Free/Standard: `rounded-t-[12px] overflow-hidden` on the image container, with `mx-4 md:mx-8` side margins (page background visible on sides). Premium: no container margins, no border radius. Max heights: Free=360px, Standard=400px, Premium=560px desktop; all variants=240px mobile.
- **Gradient overlay:** CSS `linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 60%)` applied as an absolutely positioned div over the image.
- **Trust badge:** `role="status"` on the badge container. Checkmark icon inside badge uses `aria-hidden="true"`. Badge text is the accessible label. Charcoal badge for Unclaimed, Blue (`#3B82F6`) for Claimed.
- **Primary CTA button:** Amber Gold background (`#E2A428`), Brand Black text, Quicksand Bold Italic 16px, `px-6 py-3`, `rounded-[8px]`, min-width 140px. Label from `cta_type`: "Book Now" / "Order Online" / "Call Us" / "Visit Us" / "Message Us".
- **At-a-Glance icons:** 16px Charcoal (`#595758`), 8px gap to label. Lucide-react icons: `Tag` (category), `MapPin` (city), `Clock` (hours), `Phone` (phone), `Mail` (email), `Globe` (website).
- **Hours table:** `today's day` row has `font-semibold bg-amber-50` or equivalent subtle highlight. "Open now" in `text-[#16A34A]`. "Closed" in Charcoal.
- **Social icons:** 40px circular buttons, `border border-[#595758]`, icon in Charcoal, hover state `bg-[#595758] text-white`. Use lucide-react: `Instagram`, `Facebook`, `Linkedin`, `Youtube`; for TikTok use an SVG asset. Each renders only if the corresponding URL field is non-null.
- **States to implement:** Default (all data present), No tagline (tagline hidden, CTA moves up), No logo (logo circle absent), No contact fields (contact section hides empty rows), No social links (social section hidden entirely), No description (About section hidden), Service-area business (address row replaced with service area text)

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `listings`, `listing_details_business`, `listing_hours`, `listing_links`, `media_attachments`
- **Entities involved:** `listings`, `listing_details_business`, `listing_hours`, `listing_links`
- **Operations:** SELECT (all reads, no writes in this ticket)
- **Data sourced from:** `EntityPageData` returned by Ticket 020's page-level data fetch. No additional API calls in this ticket — all sections consume props from the parent page Server Component.
- **Key fields used:**
  - `listing.name`, `listing.tagline`, `listing.trust_tier`, `listing.listing_tier`, `listing.logo_path`, `listing.cover_image_path`, `listing.entity_type`
  - `listing.city.name`, `listing.category.name`
  - `details.description`, `details.phone`, `details.email`, `details.website_url`, `details.address_line_1`, `details.cta_type`, `details.cta_url`, `details.social_instagram`, `details.social_facebook`, `details.social_linkedin`, `details.social_tiktok`, `details.social_youtube`
  - `listing_hours` array: `day_of_week`, `open_time`, `close_time`, `is_closed`
  - `listing_links` array: `platform`, `url`
- **Cover image URL:** Generated at read time via `supabase.storage.from('listing-media').getPublicUrl(cover_image_path)`. Never store the URL. Generate in the page Server Component and pass as a prop.
- **RLS policies:** Public read — no auth required for published listings.
- **Migration required:** No — schema established in earlier tickets.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Endpoint 5: Get Entity Page by Slug
- **Endpoints involved:**
  - `GET /api/listings/[city-slug]/[entity-type]/[listing-slug]` — fetched by Ticket 020's page component; this ticket consumes `EntityPageData` as props
- **Auth required:** No (public read)
- **Response fields consumed in this ticket:** `listing`, `details`, `listing_hours`, `listing_links`
- **Error codes to handle (inherited from Ticket 020):**
  - `NOT_FOUND` / 404 → `notFound()` — renders branded 404 (handled by Ticket 020's page)
  - Unpublished listing → distinct "listing not available" state (handled by Ticket 020)

---

## Implementation Notes

**Files to create:**
- `app/[city-slug]/business/[listing-slug]/components/HeroSection.tsx` — Hero image, gradient overlay, entity name, tagline, trust badge, logo, primary CTA button placeholder (save/share buttons are Ticket 024)
- `app/[city-slug]/business/[listing-slug]/components/AtAGlanceSection.tsx` — Category, city, hours indicator, phone, email, website in horizontal/vertical responsive row
- `app/[city-slug]/business/[listing-slug]/components/AboutSection.tsx` — Description with ExpandableText
- `app/[city-slug]/business/[listing-slug]/components/HoursSection.tsx` — Full weekly hours table, open/closed indicator
- `app/[city-slug]/business/[listing-slug]/components/ContactSection.tsx` — Phone, email, website, address blocks
- `app/[city-slug]/business/[listing-slug]/components/SocialLinksSection.tsx` — Social platform icon buttons
- `app/[city-slug]/business/[listing-slug]/components/ClaimPromptBand.tsx` — Unclaimed page claim prompt (conditional)
- `lib/utils/hours.ts` — `getOpenStatus(listing_hours, cityTimezone): { isOpen: boolean; todayHours: string; nextOpenTime: string | null }` utility

**Files to modify:**
- `app/[city-slug]/business/[listing-slug]/page.tsx` (Ticket 020) — Import and compose all section components, pass `EntityPageData` props

**Key patterns:**
- All section components are Server Components (no `"use client"` directive). They receive props from the parent page Server Component.
- `next/image` with `priority` on the hero cover image (above the fold). Use `sizes` prop: `"100vw"` for Premium full-bleed, `"(max-width: 960px) 100vw, 960px"` for Free/Standard.
- Tier check: `listing.listing_tier === 'premium'` determines full-bleed vs. boxed hero treatment. Pass `isPremium` boolean prop to `HeroSection`.
- Hours open/closed: compute in `lib/utils/hours.ts`. Import in `HoursSection.tsx` and `AtAGlanceSection.tsx`. Do NOT use `Date.now()` inside a client component — compute server-side so it reflects render time (ISR will cache this, which is acceptable; hours change infrequently and 1h ISR is correct).
- Social links: render only icons where the corresponding URL is non-null. Do not render an empty social links section.
- Description expand/collapse: `"use client"` for `ExpandableText` component only. All other section components remain Server Components.
- Respect the `max-w-[960px] mx-auto` constraint on all section content. Section background colors extend `w-full`.
- For address: detect OS with `navigator.userAgent` to link to Google Maps vs. Apple Maps — but since these are Server Components, generate a Google Maps URL by default (`https://maps.google.com/?q=...`). Apple Maps detection is a Client Component concern and is deferred to V1.

**Do not:**
- Add `"use client"` to section components unless the component requires browser APIs or React state.
- Implement save/share button functionality (Ticket 024).
- Hardcode any colors — use Tailwind config tokens.
- Show an empty "No photos" state in the gallery position (gallery is hidden if no images; gallery is Ticket 022).
- Implement sticky CTA bar here (Ticket 024).

---

## Acceptance Criteria

- [ ] Given a published Business listing with a cover image, when the page loads, the hero renders the full-bleed or boxed cover image (correct per `listing_tier`), gradient overlay, business name in Glacial Indifference Bold, and primary CTA button in Amber Gold with the correct label derived from `cta_type`.
- [ ] Given a listing with `trust_tier = 'unclaimed'`, the trust badge renders in Charcoal (#595758) with "Unclaimed" text and the claim prompt band renders above the At-a-Glance section.
- [ ] Given a listing with `trust_tier = 'claimed'`, the trust badge renders in Blue (#3B82F6) with "Claimed" text and a checkmark icon; the claim prompt band does not render.
- [ ] Given a listing with `listing_tier = 'premium'`, the hero image extends edge-to-edge with no side margins and no border radius. Given `listing_tier = 'free'` or `'standard'`, the hero image is boxed within the 960px container with visible side margins and 12px top border radius.
- [ ] Given a listing with hours data, the At-a-Glance section displays "Open now" in green (#16A34A) or "Closed — Opens at [time]" in Charcoal based on the current server render time relative to `listing_hours`.
- [ ] Given a listing with a description longer than 200 words, the About section truncates to approximately 4 lines with a fade gradient, and a "Read more" Amber Gold link expands the full text with a smooth CSS height transition. "Read less" collapses it.
- [ ] Given a listing with a description of 200 words or fewer, the About section renders the full description with no expand/collapse toggle.
- [ ] Given a listing with a phone number, the phone renders as a `tel:` link in the Contact section and in At-a-Glance; given no phone, neither the phone row in Contact nor the phone item in At-a-Glance renders.
- [ ] Given a listing with no social links (all social URL fields null), the Social Links section is hidden entirely — no empty section heading or empty icon row.
- [ ] Given a listing with `address_line_1 = null` and `location_type = 'online'` or a service-area flag, the Contact section shows "Service area: [city_text]" rather than an address row.
- [ ] At 375px viewport width, the hero image is 240px tall, the entity name renders at 28px, the tagline is hidden, the CTA button is full-width, and the At-a-Glance items stack in a single column.
- [ ] All interactive elements (primary CTA, phone link, email link, website link, social icon buttons, Google Maps link) are keyboard-navigable with visible focus states.
- [ ] The primary CTA button has an accessible label matching its visible text. Trust badge has `role="status"`. Badge icons are `aria-hidden="true"`. Social link buttons have `aria-label="[Platform name] for [Business Name]"`.

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Cover image fails to load | Storage path invalid or CDN error | `next/image` built-in error boundary renders an empty placeholder; hero gradient and text remain visible over the `#19191E` background | No explicit retry; page remains functional without the image |
| Logo fails to load | Logo storage path invalid | Logo circle is hidden; entity name remains visible in correct position | No retry needed |
| No description provided | `details.description = null` | About section is hidden entirely; no empty heading or blank space | None — expected state |
| No hours data | `listing_hours` is empty array | Hours row in At-a-Glance is hidden; Hours section is hidden | None — expected state |
| Open/closed computation error | Timezone data invalid or missing | Default to "See hours below" in At-a-Glance, full hours table still renders | N/A |
| No contact fields | phone/email/website/address all null | Contact section hidden entirely | None — expected state |

---

## Edge Cases

- Business name exceeds 40 characters on mobile (28px): must wrap gracefully, not overflow the hero container.
- Tagline is exactly one character longer than fits on one line: truncate with ellipsis on mobile (hidden on mobile anyway); allow two lines on desktop before truncation.
- `cta_type = 'call'` and `details.phone = null`: render the CTA button with label "Call Us" but disable it and add `aria-disabled="true"`. Do not hide it — the owner configured it.
- Description contains only whitespace or only newlines: treat as null (hide the About section).
- All seven days in `listing_hours` have `is_closed = true`: display "Temporarily closed" in At-a-Glance instead of open/closed logic.
- `listing.logo_path` is set but the file was deleted from storage: `next/image` error fallback hides the logo element, page functions normally.
- Social links section has exactly one platform: renders a single icon button in the row, not a grid.
- Cover image is portrait orientation: `object-fit: cover` centered on vertical midpoint prevents awkward cropping; this is correct per design system (owner is responsible for image quality).

---

## Accessibility Notes

- [ ] `h1` for entity name is the only `h1` on the page. All section headings use `h2`. Service names use `h3`.
- [ ] Primary CTA button is a semantic `<a>` (if external URL) or `<button>` (if `tel:` or same-page action). Label text matches visible button text exactly.
- [ ] Phone link: `<a href="tel:..." aria-label="Call [Business Name]">` — aria-label adds entity context.
- [ ] Email link: `<a href="mailto:..." aria-label="Email [Business Name]">`.
- [ ] Social icon buttons: `<a href="..." target="_blank" rel="noopener noreferrer" aria-label="[Platform] for [Business Name]">`.
- [ ] "Read more" / "Read less" expand toggle: `aria-expanded` attribute reflects current state. `aria-controls` points to the expandable text container ID.
- [ ] Trust badge container: `role="status"`. Badge icon: `aria-hidden="true"`.
- [ ] Google Maps link: `aria-label="Get directions to [Business Name]"`.
- [ ] Color contrast: White text on hero gradient (#000 at 72% opacity) passes WCAG AA. Charcoal on White in At-a-Glance passes WCAG AA. Amber Gold text (website link) is ≥14px Bold — meets minimum threshold per design system.
- [ ] All interactive elements reachable via Tab key. Focus ring visible (not removed with `outline: none` without replacement).

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-021-1 | Happy path — full data Business page | Navigate to a published Business listing with all fields populated (name, tagline, cover image, logo, phone, email, website, address, hours, social links) | All sections render correctly: hero with image+gradient+name+tagline+CTA+trust badge; At-a-Glance with all items; About with description; Hours with weekly schedule; Contact with all four items; Social with all platform icons |
| QA-021-2 | Open/closed indicator accuracy | Navigate to a Business page where current time is within the listed hours for today | "Open now" shown in green in At-a-Glance and today's row highlighted in Hours section |
| QA-021-3 | Unclaimed listing claim prompt | Navigate to a listing with `trust_tier = 'unclaimed'` | Charcoal trust badge, claim prompt band visible above At-a-Glance, "Claim This Page" Amber Gold button present |
| QA-021-4 | Mobile 375px layout | Open the page on a 375px viewport | Hero image 240px tall, tagline hidden, entity name 28px, CTA full-width, At-a-Glance single-column stacked |
| QA-021-5 | Missing optional fields | Navigate to a listing where phone, email, website, address, logo, tagline, social links, and description are all null | Hero renders with name and CTA (no logo, no tagline); At-a-Glance shows only category + city; About section hidden; Contact section hidden; Social section hidden; no broken layouts or empty section headings |
| QA-021-6 | Description expand/collapse | Navigate to a listing with a description longer than 200 words | Description truncated at ~4 lines with gradient fade and "Read more" link. Clicking "Read more" expands full text smoothly. "Read less" collapses it. |
| QA-021-7 | Premium tier full-bleed hero | Navigate to a listing with `listing_tier = 'premium'` | Hero image extends edge-to-edge with no side margins and no border-radius on the image container |
| QA-021-8 | Keyboard navigation | Tab through the page | Focus moves in logical order: CTA button → share/save (Ticket 024) → phone → email → website → address → social icons. All elements reachable with Tab, activatable with Enter/Space. |

---

## Security Notes

- All data is read-only in this ticket — no write operations.
- Cover image and logo URLs are generated server-side via `getPublicUrl` — never constructed from untrusted user input on the client.
- Social link URLs from `listing_links` are rendered with `rel="noopener noreferrer"` to prevent tab-napping.
- `target="_blank"` links always paired with `rel="noopener noreferrer"`.
- No user-supplied HTML is rendered (description is plain text, rendered as `<p>` elements with double-newline splitting — never `dangerouslySetInnerHTML`).

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Happy path tested in browser (listing with all fields populated)
- [ ] Missing-field states tested (null phone, null description, null social links)
- [ ] Open/closed indicator verified against actual time
- [ ] Mobile tested at 375px (hero height, tagline hidden, single-column At-a-Glance)
- [ ] Keyboard navigation tested (Tab through all interactive elements)
- [ ] Screen reader tested on hero and contact sections (VoiceOver or NVDA)
- [ ] Gradient overlay verified legible over both light and dark cover images
- [ ] Free/Standard vs. Premium hero treatment verified
